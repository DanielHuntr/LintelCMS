import { join } from "node:path";
import { ZipArchiveReader } from "../archives/zip-reader.js";
import { findBlueprintByIdOrFail } from "../blueprints/blueprints.service.js";
import { findCollectionOrFail } from "../collections/collections.service.js";
import type { Database, DatabaseOrTransaction } from "../database/client.js";
import type { AssetExists } from "../fieldtypes/image-assets.js";
import { noAssetUsage } from "../media/asset-lookup.js";
import type { StorageDriver } from "../media/storage-driver.js";
import { DEFAULT_TRANSFORM_CACHE_FOLDER } from "../media/transform-cache.js";
import { findSiteWithLocales } from "../sites/locales.service.js";
import { importEntry } from "./wordpress-entries.js";
import { findFieldMapping } from "./wordpress-fields.js";
import type { CollectionTarget, ItemContext, ItemResult } from "./wordpress-import-context.js";
import { buildReport } from "./wordpress-import-report.js";
import {
  countFinishedItems,
  finishItem,
  listItems,
  listPendingItems,
  updateImport,
} from "./wordpress-import.repository.js";
import type { WordPressImportMapping, WordPressImportReport } from "./wordpress-import.schema.js";
import type { WordPressImportItemRow, WordPressImportRow } from "./wordpress-import.table.js";
import {
  type AuthorPayload,
  type FilePayload,
  importAuthor,
  importFile,
  importTerm,
  type TermPayload,
} from "./wordpress-item-handlers.js";
import {
  contentZipMediaSource,
  type DownloadOptions,
  downloadingMediaSource,
} from "./wordpress-media.js";
import type { WordPressItem } from "./wxr-parser.js";

/**
 * Carries out an import, one item at a time in the order they were listed (authors, terms,
 * files, pages parents first, then posts), each in its own transaction with the item marked
 * done. Stopping at any point loses nothing: running again carries on from the next item.
 */
export interface RunnerOptions {
  database: Database;
  storage: StorageDriver;
  publicApiUrl: string;
  assetExists: AssetExists;
  importsFolder: string;
  download: DownloadOptions;
}

const BATCH_SIZE = 25;

export async function runWordPressImport(
  options: RunnerOptions,
  row: WordPressImportRow,
  mapping: WordPressImportMapping,
): Promise<void> {
  const zip = await openContentZip(options, row, mapping);
  try {
    const context = await buildItemContext(options, options.database, row, mapping, false, zip);
    for (;;) {
      const batch = await listPendingItems(options.database, row.id, BATCH_SIZE);
      if (batch.length === 0) {
        break;
      }
      for (const item of batch) {
        await options.database.transaction(async (transaction) => {
          const result = await processItem({ ...context, database: transaction }, item);
          await finishItem(transaction, item.id, result);
          rememberTarget(context.targets, item, result.targetId, result.status);
        });
        await updateImport(options.database, row.id, {
          progress: {
            done: await countFinishedItems(options.database, row.id),
            total: row.progress.total,
          },
        });
      }
    }
    await updateImport(options.database, row.id, { status: "complete", completedAt: new Date() });
  } finally {
    zip?.close();
  }
}

/** What the import would do: the whole run inside a transaction that is then rolled back. */
export async function dryRunWordPressImport(
  options: RunnerOptions,
  row: WordPressImportRow,
  mapping: WordPressImportMapping,
): Promise<WordPressImportReport> {
  const zip = await openContentZip(options, row, mapping);
  let report: WordPressImportReport | undefined;
  try {
    await options.database.transaction(async (transaction) => {
      const context = await buildItemContext(options, transaction, row, mapping, true, zip);
      for (const item of await listItems(transaction, row.id)) {
        if (item.status !== "pending") {
          continue;
        }
        const result = await processItem(context, item);
        await finishItem(transaction, item.id, result);
        rememberTarget(context.targets, item, result.targetId, result.status);
      }
      report = buildReport(await listItems(transaction, row.id), true);
      transaction.rollback();
    });
  } catch (error) {
    if (!report) {
      throw error;
    }
  } finally {
    zip?.close();
  }
  if (!report) {
    throw new Error("The dry run didn't finish.");
  }
  return report;
}

async function openContentZip(
  options: RunnerOptions,
  row: WordPressImportRow,
  mapping: WordPressImportMapping,
) {
  if (mapping.media !== "zip" || !row.contentZipFile) {
    return undefined;
  }
  return ZipArchiveReader.open(join(options.importsFolder, row.contentZipFile));
}

async function buildItemContext(
  options: RunnerOptions,
  database: DatabaseOrTransaction,
  row: WordPressImportRow,
  mapping: WordPressImportMapping,
  dryRun: boolean,
  zip: ZipArchiveReader | undefined,
): Promise<ItemContext> {
  const site = await findSiteWithLocales(database);
  const taxonomies = { categories: mapping.categoriesTaxonomy, tags: mapping.tagsTaxonomy };
  const targets = new Map<string, string>();
  for (const item of await listItems(database, row.id)) {
    rememberTarget(targets, item, item.targetId, item.status);
  }
  return {
    database,
    importId: row.id,
    dryRun,
    mapping,
    startedBy: row.startedBy ?? "",
    siteId: site.id,
    locale: site.locale,
    posts: await collectionTarget(database, mapping.postsCollection, taxonomies),
    pages: await collectionTarget(database, mapping.pagesCollection, taxonomies),
    media:
      mapping.media === "skip"
        ? null
        : zip
          ? contentZipMediaSource(zip)
          : downloadingMediaSource(options.download),
    mediaContext: (mediaDatabase) => ({
      database: mediaDatabase,
      storage: options.storage,
      cacheFolder: DEFAULT_TRANSFORM_CACHE_FOLDER,
      publicApiUrl: options.publicApiUrl,
      usageFinder: noAssetUsage,
    }),
    // A dry run "brings in" images without saving them, so it can't check they exist.
    assetExists: dryRun ? async () => true : options.assetExists,
    targets,
  };
}

export async function collectionTarget(
  database: DatabaseOrTransaction,
  handle: string | null,
  taxonomies: { categories: string | null; tags: string | null },
): Promise<CollectionTarget | null> {
  if (handle === null) {
    return null;
  }
  const collection = await findCollectionOrFail(database, handle);
  const blueprint = await findBlueprintByIdOrFail(database, collection.blueprintId);
  return {
    collection,
    fields: blueprint.fields,
    fieldMapping: findFieldMapping(blueprint.fields, taxonomies),
  };
}

function rememberTarget(
  targets: Map<string, string>,
  item: Pick<WordPressImportItemRow, "kind" | "sourceId" | "payload">,
  targetId: string | null,
  status: string,
) {
  if (status !== "done" || !targetId) {
    return;
  }
  targets.set(`${item.kind}:${item.sourceId}`, targetId);
  if (typeof item.payload.url === "string") {
    targets.set(`url:${item.payload.url}`, targetId);
  }
}

function processItem(context: ItemContext, item: WordPressImportItemRow): Promise<ItemResult> {
  const payload = item.payload;
  switch (item.kind) {
    case "author":
      return importAuthor(context, payload as unknown as AuthorPayload);
    case "category":
      return importTerm(
        context,
        context.mapping.categoriesTaxonomy,
        payload as unknown as TermPayload,
      );
    case "tag":
      return importTerm(context, context.mapping.tagsTaxonomy, payload as unknown as TermPayload);
    case "attachment":
    case "image":
      return importFile(context, payload as unknown as FilePayload);
    default:
      return importEntry(context, payload as unknown as WordPressItem);
  }
}
