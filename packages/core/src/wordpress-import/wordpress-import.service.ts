import { rm } from "node:fs/promises";
import { join } from "node:path";
import type { Database } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { listCollections } from "../collections/collections.service.js";
import { listTaxonomies } from "../taxonomies/taxonomies.service.js";
import type { BackgroundTasks } from "../scheduler/background-tasks.js";
import { InvalidFieldsError } from "../http/http-errors.js";
import { listWordPressItems } from "./wordpress-import-items.js";
import { buildReport } from "./wordpress-import-report.js";
import {
  collectionTarget,
  dryRunWordPressImport,
  type RunnerOptions,
  runWordPressImport,
} from "./wordpress-import-runner.js";
import {
  WordPressImportBusyError,
  WordPressImportFinishedError,
  WordPressImportNotFoundError,
} from "./wordpress-import.errors.js";
import {
  claimImportToRun,
  deleteImport,
  findImport,
  insertImport,
  insertItems,
  listImports,
  listItems,
  pauseRunningImports,
  updateImport,
} from "./wordpress-import.repository.js";
import {
  type WordPressImportMapping,
  wordpressImportMappingSchema,
  type WordPressImportReport,
} from "./wordpress-import.schema.js";
import type { WordPressImportRow } from "./wordpress-import.table.js";
import { parseWordPressExport } from "./wxr-parser.js";

/**
 * The steps of Build → Import → WordPress: upload the export, choose where things go
 * (the mapping), see a dry run, then import with progress. An import that stops part way
 * shows as paused, and Resume carries on where it stopped.
 */
export interface WordPressImportContext extends RunnerOptions {
  tasks: BackgroundTasks;
}

export interface NewWordPressImport {
  filename: string;
  xml: string;
  /** A zip of the old site's wp-content folder, already in the imports folder. */
  contentZipFile: string | null;
  startedBy: string;
}

export async function createWordPressImport(
  context: WordPressImportContext,
  upload: NewWordPressImport,
) {
  const site = parseWordPressExport(upload.xml);
  const items = listWordPressItems(site);
  const count = (type: string) => site.items.filter((item) => item.type === type).length;
  const row = await insertImport(context.database, {
    filename: upload.filename,
    siteTitle: site.title,
    siteAddress: site.link,
    found: {
      posts: count("post"),
      pages: count("page"),
      attachments: count("attachment"),
      authors: site.authors.length,
      categories: site.categories.length,
      tags: site.tags.length,
      ignored: site.ignoredItemTypes,
    },
    progress: { done: 0, total: items.length },
    contentZipFile: upload.contentZipFile,
    startedBy: upload.startedBy,
  });
  await insertItems(
    context.database,
    items.map((item) => ({ ...item, importId: row.id })),
  );
  return describeImport(row);
}

export function describeImport(row: WordPressImportRow) {
  return {
    id: row.id,
    filename: row.filename,
    siteTitle: row.siteTitle,
    siteAddress: row.siteAddress,
    status: row.status,
    found: row.found,
    mapping: row.mapping,
    progress: row.progress,
    hasContentZip: row.contentZipFile !== null,
    lastError: row.lastError,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

export type WordPressImportResponse = ReturnType<typeof describeImport>;

export async function listWordPressImports(database: Database) {
  return (await listImports(database, DEFAULT_TENANT_ID)).map(describeImport);
}

async function findImportOrFail(database: Database, importId: string) {
  const row = await findImport(database, DEFAULT_TENANT_ID, importId);
  if (!row) {
    throw new WordPressImportNotFoundError();
  }
  return row;
}

/** The import with its report so far, for the progress and finished screens. */
export async function getWordPressImport(database: Database, importId: string) {
  const row = await findImportOrFail(database, importId);
  const report =
    row.status === "ready" ? null : buildReport(await listItems(database, row.id), false);
  return { ...describeImport(row), report };
}

/** What the mapping screen offers: the collections and taxonomies here, and a starting choice. */
export async function describeMappingChoices(context: WordPressImportContext, importId: string) {
  const row = await findImportOrFail(context.database, importId);
  const { collections } = await listCollections(context.database);
  const { taxonomies } = await listTaxonomies(context.database);
  const has = (handle: string, list: Array<{ handle: string }>) =>
    list.some((item) => item.handle === handle) ? handle : null;
  const suggested: WordPressImportMapping = row.mapping ?? {
    ...wordpressImportMappingSchema.parse({}),
    postsCollection: has("posts", collections),
    pagesCollection: has("pages", collections),
    categoriesTaxonomy: has("categories", taxonomies),
    tagsTaxonomy: has("tags", taxonomies),
  };
  return {
    import: describeImport(row),
    collections: collections.map((collection) => ({
      handle: collection.handle,
      name: collection.name,
    })),
    taxonomies: taxonomies.map((taxonomy) => ({ handle: taxonomy.handle, name: taxonomy.name })),
    suggested,
  };
}

/** Which field of a collection each part of a post would go into, for the mapping screen. */
export async function describeFieldMapping(
  context: WordPressImportContext,
  mapping: WordPressImportMapping,
) {
  const taxonomies = { categories: mapping.categoriesTaxonomy, tags: mapping.tagsTaxonomy };
  const posts = await collectionTarget(context.database, mapping.postsCollection, taxonomies);
  const pages = await collectionTarget(context.database, mapping.pagesCollection, taxonomies);
  return { posts: posts?.fieldMapping ?? null, pages: pages?.fieldMapping ?? null };
}

export async function saveMapping(
  context: WordPressImportContext,
  importId: string,
  mapping: WordPressImportMapping,
): Promise<WordPressImportMapping> {
  const row = await findImportOrFail(context.database, importId);
  if (row.status === "running") {
    throw new WordPressImportBusyError();
  }
  if (row.status === "complete") {
    throw new WordPressImportFinishedError();
  }
  if (mapping.media === "zip" && !row.contentZipFile) {
    throw new InvalidFieldsError({
      media: "Upload a wp-content zip first, or download the images",
    });
  }
  await describeFieldMapping(context, mapping);
  await updateImport(context.database, importId, { mapping });
  return mapping;
}

export async function dryRunImport(
  context: WordPressImportContext,
  importId: string,
): Promise<WordPressImportReport> {
  const row = await findImportOrFail(context.database, importId);
  return dryRunWordPressImport(context, row, mappingOf(row));
}

/** Starts (or resumes) the import in the background; poll `getWordPressImport` for progress. */
export async function startWordPressImport(context: WordPressImportContext, importId: string) {
  const row = await findImportOrFail(context.database, importId);
  if (row.status === "complete") {
    throw new WordPressImportFinishedError();
  }
  const mapping = mappingOf(row);
  if (!(await claimImportToRun(context.database, importId))) {
    throw new WordPressImportBusyError();
  }
  context.tasks.start(async () => {
    try {
      await runWordPressImport(context, row, mapping);
      await removeContentZip(context, row);
    } catch (error) {
      await updateImport(context.database, importId, {
        status: "paused",
        lastError: error instanceof Error ? error.message : "The import stopped.",
      });
    }
  });
  return describeImport({ ...row, status: "running" });
}

function mappingOf(row: WordPressImportRow): WordPressImportMapping {
  return row.mapping ?? wordpressImportMappingSchema.parse({});
}

export async function deleteWordPressImport(context: WordPressImportContext, importId: string) {
  const row = await findImportOrFail(context.database, importId);
  if (row.status === "running") {
    throw new WordPressImportBusyError();
  }
  await removeContentZip(context, row);
  await deleteImport(context.database, importId);
}

async function removeContentZip(context: WordPressImportContext, row: WordPressImportRow) {
  if (row.contentZipFile) {
    await rm(join(context.importsFolder, row.contentZipFile), { force: true });
    await updateImport(context.database, row.id, { contentZipFile: null });
  }
}

/** An import running when the server stopped shows as paused, ready to resume. */
export function pauseInterruptedImports(database: Database): Promise<void> {
  return pauseRunningImports(
    database,
    DEFAULT_TENANT_ID,
    "Lintel stopped while this import was running. Resume it to carry on where it stopped.",
  );
}
