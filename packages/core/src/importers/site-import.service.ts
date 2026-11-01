import { rm } from "node:fs/promises";
import { join } from "node:path";
import { ZipArchiveReader } from "../archives/zip-reader.js";
import { listBlueprints } from "../blueprints/blueprints.service.js";
import { listCollections } from "../collections/collections.service.js";
import type { Database } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { InvalidFieldsError } from "../http/http-errors.js";
import type { BackgroundTasks } from "../scheduler/background-tasks.js";
import { listTaxonomies } from "../taxonomies/taxonomies.service.js";
import { archiveLimitsForImports } from "./import-archives.js";
import { describeFound, listSiteItems } from "./site-import-items.js";
import { type ExistingField, findMappingProblems, suggestMapping } from "./site-import-mapping.js";
import { buildSiteReport } from "./site-import-report.js";
import { dryRunSiteImport, runSiteImport, type SiteRunnerOptions } from "./site-import-runner.js";
import {
  SiteImportBusyError,
  SiteImportFinishedError,
  SiteImportNotFoundError,
} from "./site-import.errors.js";
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
} from "./site-import.repository.js";
import {
  type ImportSource,
  type SiteImportMapping,
  siteImportMappingSchema,
  type SiteImportReport,
} from "./site-import.schema.js";
import type { SiteImportRow } from "./site-import.table.js";
import { sourceReaders } from "./sources/source-readers.js";

/**
 * The steps of Settings → Import for Webflow, Framer, Statamic and Umbraco, the same as
 * for WordPress: upload the files, choose where things go (the mapping), see a dry run,
 * then import with progress, in the background. An import that stops part way shows as
 * paused, and Resume carries on where it stopped.
 */
export interface SiteImportContext extends SiteRunnerOptions {
  tasks: BackgroundTasks;
}

export interface NewSiteImport {
  source: ImportSource;
  /** What people uploaded, to name the import in the list. */
  filename: string;
  files: Array<{ filename: string; text: string }>;
  /** An uploaded zip, already moved into the imports folder, by its name there. */
  archiveFile: string | null;
  startedBy: string;
}

export async function createSiteImport(context: SiteImportContext, upload: NewSiteImport) {
  const archive = upload.archiveFile
    ? await ZipArchiveReader.open(
        join(context.importsFolder, upload.archiveFile),
        archiveLimitsForImports,
      )
    : null;
  try {
    const site = await sourceReaders[upload.source]({ files: upload.files, archive });
    const items = listSiteItems(site);
    const row = await insertImport(context.database, {
      source: upload.source,
      filename: upload.filename,
      siteTitle: site.title,
      siteAddress: site.address,
      found: describeFound(site),
      mediaHosts: site.mediaHosts,
      progress: { done: 0, total: items.length },
      archiveFile: upload.archiveFile,
      startedBy: upload.startedBy,
    });
    await insertItems(
      context.database,
      items.map((item) => ({ ...item, importId: row.id })),
    );
    return describeSiteImport(row);
  } finally {
    archive?.close();
  }
}

export function describeSiteImport(row: SiteImportRow) {
  return {
    id: row.id,
    source: row.source,
    filename: row.filename,
    siteTitle: row.siteTitle,
    siteAddress: row.siteAddress,
    status: row.status,
    found: row.found,
    mapping: row.mapping,
    mediaHosts: row.mediaHosts,
    progress: row.progress,
    hasArchive: row.archiveFile !== null,
    lastError: row.lastError,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

export type SiteImportResponse = ReturnType<typeof describeSiteImport>;

export async function listSiteImports(database: Database, source?: ImportSource) {
  const rows = await listImports(database, DEFAULT_TENANT_ID);
  return rows.filter((row) => !source || row.source === source).map(describeSiteImport);
}

async function findImportOrFail(database: Database, importId: string) {
  const row = await findImport(database, DEFAULT_TENANT_ID, importId);
  if (!row) throw new SiteImportNotFoundError();
  return row;
}

/** The import with its report so far, for the progress and finished screens. */
export async function getSiteImport(database: Database, importId: string) {
  const row = await findImportOrFail(database, importId);
  const report =
    row.status === "ready"
      ? null
      : buildSiteReport(await listItems(database, row.id), false, row.found.notes);
  return { ...describeSiteImport(row), report };
}

/** What the mapping screen offers: collections and their fields, taxonomies, a starting choice. */
export async function describeSiteMappingChoices(context: SiteImportContext, importId: string) {
  const row = await findImportOrFail(context.database, importId);
  const collectionFields = await listCollectionFields(context.database);
  const { collections } = await listCollections(context.database);
  const { taxonomies } = await listTaxonomies(context.database);
  return {
    import: describeSiteImport(row),
    collections: collections.map((collection) => ({
      handle: collection.handle,
      name: collection.name,
      structure: collection.structure,
    })),
    collectionFields,
    taxonomies: taxonomies.map((taxonomy) => ({ handle: taxonomy.handle, name: taxonomy.name })),
    suggested: row.mapping ?? suggestMapping(row.found, collectionFields),
  };
}

export async function saveSiteMapping(
  context: SiteImportContext,
  importId: string,
  mapping: SiteImportMapping,
): Promise<SiteImportMapping> {
  const row = await findImportOrFail(context.database, importId);
  if (row.status === "running") throw new SiteImportBusyError();
  if (row.status === "complete") throw new SiteImportFinishedError();
  const problems = findMappingProblems(
    row.found,
    mapping,
    await listCollectionFields(context.database),
  );
  if (Object.keys(problems).length > 0) throw new InvalidFieldsError(problems);
  await updateImport(context.database, importId, { mapping });
  return mapping;
}

export async function dryRunSite(
  context: SiteImportContext,
  importId: string,
): Promise<SiteImportReport> {
  const row = await findImportOrFail(context.database, importId);
  return dryRunSiteImport(context, row, await mappingOf(context, row));
}

/** Starts (or resumes) the import in the background; poll `getSiteImport` for progress. */
export async function startSiteImport(context: SiteImportContext, importId: string) {
  const row = await findImportOrFail(context.database, importId);
  if (row.status === "complete") throw new SiteImportFinishedError();
  const mapping = await mappingOf(context, row);
  if (!row.mapping) await updateImport(context.database, importId, { mapping });
  if (!(await claimImportToRun(context.database, importId))) throw new SiteImportBusyError();
  context.tasks.start(async () => {
    try {
      await runSiteImport(context, row, mapping);
      await removeArchive(context, row);
    } catch (error) {
      await updateImport(context.database, importId, {
        status: "paused",
        lastError: error instanceof Error ? error.message : "The import stopped.",
      });
    }
  });
  return describeSiteImport({ ...row, status: "running" });
}

/** The mapping chosen, or the suggested one when nobody changed it. */
async function mappingOf(context: SiteImportContext, row: SiteImportRow) {
  return row.mapping ?? suggestMapping(row.found, await listCollectionFields(context.database));
}

export async function deleteSiteImport(context: SiteImportContext, importId: string) {
  const row = await findImportOrFail(context.database, importId);
  if (row.status === "running") throw new SiteImportBusyError();
  await removeArchive(context, row);
  await deleteImport(context.database, importId);
}

async function removeArchive(context: SiteImportContext, row: SiteImportRow) {
  if (row.archiveFile) {
    await rm(join(context.importsFolder, row.archiveFile), { force: true });
    await updateImport(context.database, row.id, { archiveFile: null });
  }
}

/** An import running when the server stopped shows as paused, ready to resume. */
export function pauseInterruptedSiteImports(database: Database): Promise<void> {
  return pauseRunningImports(
    database,
    DEFAULT_TENANT_ID,
    "Lintel stopped while this import was running. Resume it to carry on where it stopped.",
  );
}

/** Each collection's fields, for matching and for the mapping screen's choices. */
async function listCollectionFields(database: Database): Promise<Record<string, ExistingField[]>> {
  const { collections } = await listCollections(database);
  const { blueprints } = await listBlueprints(database);
  const byHandle = new Map(blueprints.map((blueprint) => [blueprint.handle, blueprint]));
  return Object.fromEntries(
    collections.map((collection) => [
      collection.handle,
      (byHandle.get(collection.blueprintHandle)?.fields ?? [])
        .filter((field) => field.handle !== "title")
        .map((field) => ({ handle: field.handle, label: field.label, type: field.type })),
    ]),
  );
}

export { siteImportMappingSchema };
