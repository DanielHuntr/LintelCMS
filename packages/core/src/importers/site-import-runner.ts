import { join } from "node:path";
import { ZipArchiveReader } from "../archives/zip-reader.js";
import type { Database, DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import type { AssetExists } from "../fieldtypes/image-assets.js";
import { noAssetUsage } from "../media/asset-lookup.js";
import { findAssetById } from "../media/media.repository.js";
import type { StorageDriver } from "../media/storage-driver.js";
import { DEFAULT_TRANSFORM_CACHE_FOLDER } from "../media/transform-cache.js";
import { findSiteWithLocales } from "../sites/locales.service.js";
import type { ItemResult } from "../wordpress-import/wordpress-import-context.js";
import type { DownloadOptions } from "../wordpress-import/wordpress-media.js";
import { archiveLimitsForImports } from "./import-archives.js";
import type { SiteItemContext } from "./site-import-context.js";
import { importSiteEntry } from "./site-import-entries.js";
import { siteMediaSource } from "./site-import-media.js";
import { buildSiteReport } from "./site-import-report.js";
import {
  countFinishedItems,
  finishItem,
  listItems,
  listPendingItems,
  updateImport,
} from "./site-import.repository.js";
import type { SiteImportMapping, SiteImportReport } from "./site-import.schema.js";
import type { SiteImportItemRow, SiteImportRow } from "./site-import.table.js";
import {
  importContentType,
  importGlobalSet,
  importMedia,
  importMenu,
  importTaxonomy,
  importTerm,
} from "./site-import-steps.js";
import type {
  SourceContentType,
  SourceEntry,
  SourceGlobalSet,
  SourceMedia,
  SourceMenu,
  SourceTerm,
} from "./source-site.js";

/**
 * Carries out a site import one item at a time, in the order they were listed, each in its
 * own transaction with the item marked done. Stopping at any point loses nothing: running
 * again carries on from the next item. The same design as the WordPress importer's runner.
 */
export interface SiteRunnerOptions {
  database: Database;
  storage: StorageDriver;
  publicApiUrl: string;
  importsFolder: string;
  download: DownloadOptions;
}

const BATCH_SIZE = 25;

export async function runSiteImport(
  options: SiteRunnerOptions,
  row: SiteImportRow,
  mapping: SiteImportMapping,
): Promise<void> {
  const archive = await openArchive(options, row);
  try {
    const context = await buildContext(options, options.database, row, mapping, false, archive);
    for (;;) {
      const batch = await listPendingItems(options.database, row.id, BATCH_SIZE);
      if (batch.length === 0) break;
      for (const item of batch) {
        await options.database.transaction(async (transaction) => {
          const result = await processItem(
            { ...context, database: transaction, assetExists: assetExistsIn(transaction) },
            item,
          );
          await finishItem(transaction, item.id, result);
          rememberTarget(context.targets, item, result);
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
    archive?.close();
  }
}

/** What the import would do: the whole run inside a transaction that is then rolled back. */
export async function dryRunSiteImport(
  options: SiteRunnerOptions,
  row: SiteImportRow,
  mapping: SiteImportMapping,
): Promise<SiteImportReport> {
  const archive = await openArchive(options, row);
  let report: SiteImportReport | undefined;
  try {
    await options.database.transaction(async (transaction) => {
      const context = await buildContext(options, transaction, row, mapping, true, archive);
      for (const item of await listItems(transaction, row.id)) {
        if (item.status !== "pending") continue;
        const result = await processItem(context, item);
        await finishItem(transaction, item.id, result);
        rememberTarget(context.targets, item, result);
      }
      report = buildSiteReport(await listItems(transaction, row.id), true, row.found.notes);
      transaction.rollback();
    });
  } catch (error) {
    if (!report) throw error;
  } finally {
    archive?.close();
  }
  if (!report) throw new Error("The dry run didn't finish.");
  return report;
}

async function openArchive(options: SiteRunnerOptions, row: SiteImportRow) {
  if (!row.archiveFile) return undefined;
  return ZipArchiveReader.open(
    join(options.importsFolder, row.archiveFile),
    archiveLimitsForImports,
  );
}

async function buildContext(
  options: SiteRunnerOptions,
  database: DatabaseOrTransaction,
  row: SiteImportRow,
  mapping: SiteImportMapping,
  dryRun: boolean,
  archive: ZipArchiveReader | undefined,
): Promise<SiteItemContext> {
  const site = await findSiteWithLocales(database);
  const targets = new Map<string, string>();
  for (const item of await listItems(database, row.id)) {
    rememberTarget(targets, item, item);
  }
  return {
    database,
    serverDatabase: options.database,
    importId: row.id,
    source: row.source,
    siteAddress: row.siteAddress,
    dryRun,
    mapping,
    found: row.found,
    startedBy: row.startedBy ?? "",
    siteId: site.id,
    locale: site.locale,
    media:
      mapping.media === "skip"
        ? null
        : siteMediaSource({
            archive,
            download: options.download,
            siteAddress: row.siteAddress,
            hosts: [...row.mediaHosts, ...mapping.mediaHosts],
          }),
    mediaContext: (mediaDatabase) => ({
      database: mediaDatabase,
      storage: options.storage,
      cacheFolder: DEFAULT_TRANSFORM_CACHE_FOLDER,
      publicApiUrl: options.publicApiUrl,
      usageFinder: noAssetUsage,
    }),
    // A dry run "brings in" pictures without saving them, so it can't check they exist.
    assetExists: dryRun ? async () => true : assetExistsIn(database),
    targets,
  };
}

/** Checked inside the item's own transaction: the built-in database has one connection. */
function assetExistsIn(database: DatabaseOrTransaction): AssetExists {
  return async (assetId) =>
    (await findAssetById(database, DEFAULT_TENANT_ID, assetId)) !== undefined;
}

function rememberTarget(
  targets: Map<string, string>,
  item: Pick<SiteImportItemRow, "kind" | "sourceId" | "payload">,
  result: { status: string; targetId: string | null },
) {
  if (result.status === "failed" || !result.targetId) return;
  targets.set(`${item.kind}:${item.sourceId}`, result.targetId);
  if (item.kind === "media" && typeof item.payload.url === "string") {
    targets.set(`url:${item.payload.url}`, result.targetId);
  }
}

function processItem(context: SiteItemContext, item: SiteImportItemRow): Promise<ItemResult> {
  const payload = item.payload as unknown;
  switch (item.kind) {
    case "taxonomy":
      return importTaxonomy(context, payload as { key: string; name: string });
    case "term":
      return importTerm(context, payload as SourceTerm & { taxonomyKey: string });
    case "contentType":
      return importContentType(context, payload as SourceContentType);
    case "media":
      return importMedia(context, payload as SourceMedia);
    case "menu":
      return importMenu(context, payload as SourceMenu);
    case "global":
      return importGlobalSet(context, payload as SourceGlobalSet);
    default:
      return importSiteEntry(context, payload as SourceEntry);
  }
}
