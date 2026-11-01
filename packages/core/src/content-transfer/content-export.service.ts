import { writeFile } from "node:fs/promises";
import { ZipArchiveWriter } from "../archives/zip-writer.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { findAllowedFileType } from "../media/file-types.js";
import type { StorageDriver } from "../media/storage-driver.js";
import {
  listAssets,
  listBlueprints,
  listCollections,
  listEntries,
  listGlobalSets,
  listGlobalValues,
  listLocales,
  listMenus,
  listRevisions,
  listSites,
  listTaxonomies,
  listTerms,
} from "./content-transfer.repository.js";
import {
  EXPORT_DOCUMENT,
  EXPORT_FORMAT,
  EXPORT_FORMAT_VERSION,
  type ExportedAsset,
  type ExportedEntry,
  type LintelExport,
} from "./transfer-format.js";

/**
 * Making a Lintel export (see transfer-format.ts): content types, entries, taxonomies,
 * globals, menus and media. Used by `lintel export` and Settings → Import's "Export".
 */
export interface ExportOptions {
  /** Every saved version of each entry, not only the current one. Makes the file bigger. */
  includeRevisions: boolean;
  /** Put the media files in a .zip beside the JSON. Without them, only their details. */
  includeFiles: boolean;
}

export async function buildExportDocument(
  database: DatabaseOrTransaction,
  options: Pick<ExportOptions, "includeRevisions" | "includeFiles">,
): Promise<LintelExport> {
  const tenantId = DEFAULT_TENANT_ID;
  const [sites, locales, blueprints, collections] = await Promise.all([
    listSites(database, tenantId),
    listLocales(database, tenantId),
    listBlueprints(database, tenantId),
    listCollections(database, tenantId),
  ]);
  const blueprintHandles = new Map(blueprints.map((row) => [row.id, row.handle]));

  return {
    format: EXPORT_FORMAT,
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    sites: sites.map((site) => ({
      handle: site.handle,
      name: site.name,
      domain: site.domain,
      locale: site.locale,
      fallbackLocale: site.fallbackLocale,
      locales: locales
        .filter((locale) => locale.siteId === site.id)
        .map((locale) => ({ code: locale.code, name: locale.name })),
    })),
    blueprints: blueprints.map((row) => ({
      id: row.id,
      handle: row.handle,
      name: row.name,
      fields: row.fields as unknown as Array<Record<string, unknown>>,
    })),
    collections: collections.map((row) => ({
      id: row.id,
      handle: row.handle,
      name: row.name,
      blueprint: blueprintHandles.get(row.blueprintId) ?? "",
      routePattern: row.routePattern,
      previewUrlPattern: row.previewUrlPattern,
      structure: row.structure,
    })),
    taxonomies: await exportTaxonomies(database),
    globals: await exportGlobals(database),
    menus: (await listMenus(database, tenantId)).map((row) => ({
      id: row.id,
      handle: row.handle,
      name: row.name,
      maxDepth: row.maxDepth,
      items: row.items as unknown as Array<Record<string, unknown>>,
    })),
    media: (await listAssets(database, tenantId)).map((row) =>
      exportAsset(row, options.includeFiles),
    ),
    entries: await exportEntries(database, options.includeRevisions, sites, collections),
  };
}

async function exportTaxonomies(database: DatabaseOrTransaction) {
  const [taxonomies, terms] = await Promise.all([
    listTaxonomies(database, DEFAULT_TENANT_ID),
    listTerms(database, DEFAULT_TENANT_ID),
  ]);
  return taxonomies.map((taxonomy) => ({
    id: taxonomy.id,
    handle: taxonomy.handle,
    name: taxonomy.name,
    terms: terms
      .filter((term) => term.taxonomyId === taxonomy.id)
      .map((term) => ({
        id: term.id,
        title: term.title,
        slug: term.slug,
        description: term.description,
      })),
  }));
}

async function exportGlobals(database: DatabaseOrTransaction) {
  const [sets, values] = await Promise.all([
    listGlobalSets(database, DEFAULT_TENANT_ID),
    listGlobalValues(database, DEFAULT_TENANT_ID),
  ]);
  return sets.map((set) => ({
    id: set.id,
    handle: set.handle,
    name: set.name,
    fields: set.fields as unknown as Array<Record<string, unknown>>,
    values: values
      .filter((value) => value.globalSetId === set.id)
      .map((value) => ({ locale: value.locale, data: value.data })),
  }));
}

type AssetRow = Awaited<ReturnType<typeof listAssets>>[number];

function exportAsset(row: AssetRow, includeFiles: boolean): ExportedAsset {
  return {
    id: row.id,
    filename: row.filename,
    mimeType: row.mimeType,
    size: row.size,
    width: row.width,
    height: row.height,
    alt: row.alt,
    focalX: row.focalX,
    focalY: row.focalY,
    contentHash: row.contentHash,
    file: includeFiles ? exportedFilePath(row.id, row.mimeType) : null,
  };
}

export function exportedFilePath(assetId: string, mimeType: string): string {
  return `media/${assetId}.${findAllowedFileType(mimeType)?.extension ?? "bin"}`;
}

async function exportEntries(
  database: DatabaseOrTransaction,
  includeRevisions: boolean,
  sites: Array<{ id: string; handle: string }>,
  collections: Array<{ id: string; handle: string }>,
): Promise<ExportedEntry[]> {
  const siteHandles = new Map(sites.map((site) => [site.id, site.handle]));
  const collectionHandles = new Map(collections.map((row) => [row.id, row.handle]));
  const entries = await listEntries(database, DEFAULT_TENANT_ID);
  const revisions = includeRevisions ? await listRevisions(database, DEFAULT_TENANT_ID) : [];

  return entries.map((entry) => ({
    id: entry.id,
    collection: collectionHandles.get(entry.collectionId) ?? "",
    site: siteHandles.get(entry.siteId) ?? "",
    locale: entry.locale,
    originId: entry.originId,
    parentId: entry.parentId,
    slug: entry.slug,
    status: entry.status,
    publishedAt: entry.publishedAt?.toISOString() ?? null,
    scheduledFor: entry.scheduledFor?.toISOString() ?? null,
    data: entry.data,
    publishedData: entry.publishedData,
    sortOrder: entry.sortOrder,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    ...(includeRevisions
      ? {
          revisions: revisions
            .filter((revision) => revision.entryId === entry.id)
            .map((revision) => ({
              id: revision.id,
              action: revision.action,
              data: revision.data,
              createdAt: revision.createdAt.toISOString(),
            })),
        }
      : {}),
  }));
}

export interface ExportContext {
  database: DatabaseOrTransaction;
  storage: StorageDriver;
}

/**
 * Writes the export to `path`: a .zip with the JSON and media files, or the JSON alone
 * when files are left out. Returns the document, for counting what went in.
 */
export async function writeExport(
  context: ExportContext,
  path: string,
  options: ExportOptions,
): Promise<LintelExport> {
  const document = await buildExportDocument(context.database, options);
  if (!options.includeFiles) {
    await writeFile(path, `${JSON.stringify(document, null, 2)}\n`);
    return document;
  }

  const writer = await ZipArchiveWriter.create(path);
  try {
    writer.addJson(EXPORT_DOCUMENT, document);
    const rows = await listAssets(context.database, DEFAULT_TENANT_ID);
    for (const asset of document.media) {
      const row = rows.find((candidate) => candidate.id === asset.id);
      if (row && asset.file && (await context.storage.exists(row.storageKey))) {
        await writer.addStream(asset.file, await context.storage.get(row.storageKey));
      }
    }
    await writer.finish();
    return document;
  } catch (error) {
    await writer.abandon();
    throw error;
  }
}
