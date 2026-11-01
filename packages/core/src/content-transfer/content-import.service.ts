import type { Database, DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";
import { findAllowedFileType } from "../media/file-types.js";
import type { StorageDriver } from "../media/storage-driver.js";
import { findSiteWithLocales } from "../sites/locales.service.js";
import type { NavigationItem } from "../navigation/navigation.schema.js";
import {
  type Decision,
  type ExistingContent,
  type ImportPlan,
  planImport,
  remapIds,
  type ResolvedImport,
} from "./content-import-plan.js";
import {
  insertLocale,
  insertRevisions,
  linkEntry,
  listAssets,
  listBlueprints,
  listCollections,
  listEntries,
  listExistingRevisionIds,
  listGlobalSets,
  listLocales,
  listMenus,
  listSites,
  listTaxonomies,
  listTerms,
  upsertAsset,
  upsertBlueprint,
  upsertCollection,
  upsertEntry,
  upsertGlobalSet,
  upsertGlobalValues,
  upsertMenu,
  upsertTaxonomy,
  upsertTerm,
} from "./content-transfer.repository.js";
import type { ImportSource } from "./import-source.js";
import type { ConflictStrategy, LintelExport } from "./transfer-format.js";

/**
 * Importing a Lintel export into this site. `previewImport` only plans; `runImport` plans
 * the same way and then carries the plan out in one transaction, so an import either goes
 * in whole or not at all. Running it again with the same file changes nothing new: every
 * item is found by the first run's ids.
 */
export interface ImportContext {
  database: Database;
  storage: StorageDriver;
}

const tenantId = DEFAULT_TENANT_ID;

export async function previewImport(
  context: ImportContext,
  source: ImportSource,
  strategy: ConflictStrategy,
): Promise<ImportPlan> {
  return (await resolve(context.database, source, strategy)).plan;
}

export async function runImport(
  context: ImportContext,
  source: ImportSource,
  strategy: ConflictStrategy,
): Promise<ImportPlan> {
  const resolved = await resolve(context.database, source, strategy);
  const document = source.document;
  // Files first: an unused file is harmless if the transaction then fails.
  const storageKeys = await putMediaFiles(context.storage, source, resolved);

  await context.database.transaction(async (transaction) => {
    const siteFor = await prepareSites(transaction, document);
    await importContentModel(transaction, document, resolved);
    await importMedia(transaction, document, resolved, storageKeys);
    await importGlobalsAndMenus(transaction, document, resolved);
    await importEntries(transaction, document, resolved, siteFor);
  });
  return resolved.plan;
}

async function resolve(
  database: DatabaseOrTransaction,
  source: ImportSource,
  strategy: ConflictStrategy,
): Promise<ResolvedImport> {
  return planImport(source.document, await loadExisting(database), strategy, source.files);
}

async function loadExisting(database: DatabaseOrTransaction): Promise<ExistingContent> {
  const [blueprints, collections, taxonomies, terms, globals, menus, assets, entries] =
    await Promise.all([
      listBlueprints(database, tenantId),
      listCollections(database, tenantId),
      listTaxonomies(database, tenantId),
      listTerms(database, tenantId),
      listGlobalSets(database, tenantId),
      listMenus(database, tenantId),
      listAssets(database, tenantId),
      listEntries(database, tenantId),
    ]);
  return { blueprints, collections, taxonomies, terms, globals, menus, assets, entries };
}

function shouldWrite(decision: Decision | undefined): decision is Decision {
  return decision !== undefined && decision.action !== "skip";
}

/** Each exported site becomes the site here with its handle, or else the default site. */
async function prepareSites(database: DatabaseOrTransaction, document: LintelExport) {
  const fallback = await findSiteWithLocales(database);
  const sites = await listSites(database, tenantId);
  const locales = await listLocales(database, tenantId);
  const siteFor = new Map<string, string>();
  for (const exported of document.sites) {
    const site = sites.find((candidate) => candidate.handle === exported.handle) ?? fallback;
    siteFor.set(exported.handle, site.id);
    for (const locale of exported.locales) {
      const known = locales.some((row) => row.siteId === site.id && row.code === locale.code);
      if (!known) {
        await insertLocale(database, { siteId: site.id, code: locale.code, name: locale.name });
      }
    }
  }
  return (handle: string) => siteFor.get(handle) ?? fallback.id;
}

async function importContentModel(
  database: DatabaseOrTransaction,
  document: LintelExport,
  { decisions, idMap }: ResolvedImport,
) {
  for (const blueprint of document.blueprints) {
    const decision = decisions.get(blueprint.id);
    if (shouldWrite(decision)) {
      await upsertBlueprint(
        database,
        {
          id: decision.targetId,
          handle: blueprint.handle,
          name: blueprint.name,
          kind: "entry",
          fields: remapIds(blueprint.fields, idMap) as unknown as FieldDefinition[],
        },
        decision.action === "update",
      );
    }
  }
  const blueprintIds = new Map(
    document.blueprints.map((row) => [row.handle, decisions.get(row.id)?.targetId]),
  );
  const existingBlueprints = await listBlueprints(database, tenantId);
  for (const collection of document.collections) {
    const decision = decisions.get(collection.id);
    const blueprintId =
      blueprintIds.get(collection.blueprint) ??
      existingBlueprints.find((row) => row.handle === collection.blueprint)?.id;
    if (shouldWrite(decision) && blueprintId) {
      await upsertCollection(
        database,
        {
          id: decision.targetId,
          handle: collection.handle,
          name: collection.name,
          blueprintId,
          routePattern: collection.routePattern,
          previewUrlPattern: collection.previewUrlPattern,
          structure: collection.structure,
        },
        decision.action === "update",
      );
    }
  }
  for (const taxonomy of document.taxonomies) {
    const decision = decisions.get(taxonomy.id);
    if (shouldWrite(decision)) {
      await upsertTaxonomy(
        database,
        { id: decision.targetId, handle: taxonomy.handle, name: taxonomy.name },
        decision.action === "update",
      );
    }
    const taxonomyId = decision?.targetId ?? taxonomy.id;
    for (const term of taxonomy.terms) {
      const termDecision = decisions.get(term.id);
      if (shouldWrite(termDecision)) {
        await upsertTerm(
          database,
          { ...term, id: termDecision.targetId, taxonomyId },
          termDecision.action === "update",
        );
      }
    }
  }
}

async function putMediaFiles(
  storage: StorageDriver,
  source: ImportSource,
  { decisions }: ResolvedImport,
): Promise<Map<string, string>> {
  const storageKeys = new Map<string, string>();
  for (const asset of source.document.media) {
    const decision = decisions.get(asset.id);
    if (decision?.action !== "create" || !asset.file) {
      continue;
    }
    const extension = findAllowedFileType(asset.mimeType)?.extension ?? "bin";
    const storageKey = `${tenantId}/${decision.targetId}.${extension}`;
    await storage.put(storageKey, await source.readFile(asset.file), asset.mimeType);
    storageKeys.set(asset.id, storageKey);
  }
  return storageKeys;
}

async function importMedia(
  database: DatabaseOrTransaction,
  document: LintelExport,
  { decisions }: ResolvedImport,
  storageKeys: ReadonlyMap<string, string>,
) {
  for (const asset of document.media) {
    const decision = decisions.get(asset.id);
    if (!shouldWrite(decision)) {
      continue;
    }
    await upsertAsset(
      database,
      {
        id: decision.targetId,
        filename: asset.filename,
        mimeType: asset.mimeType,
        size: asset.size,
        width: asset.width,
        height: asset.height,
        alt: asset.alt,
        focalX: asset.focalX,
        focalY: asset.focalY,
        contentHash: asset.contentHash,
        storageKey: storageKeys.get(asset.id) ?? "",
      },
      decision.action === "update",
    );
  }
}

async function importGlobalsAndMenus(
  database: DatabaseOrTransaction,
  document: LintelExport,
  { decisions, idMap }: ResolvedImport,
) {
  for (const globalSet of document.globals) {
    const decision = decisions.get(globalSet.id);
    if (!shouldWrite(decision)) {
      continue;
    }
    await upsertGlobalSet(
      database,
      {
        id: decision.targetId,
        handle: globalSet.handle,
        name: globalSet.name,
        fields: globalSet.fields as unknown as FieldDefinition[],
      },
      decision.action === "update",
    );
    for (const values of globalSet.values) {
      await upsertGlobalValues(database, {
        globalSetId: decision.targetId,
        locale: values.locale,
        data: remapIds(values.data, idMap),
      });
    }
  }
  for (const menu of document.menus) {
    const decision = decisions.get(menu.id);
    if (shouldWrite(decision)) {
      await upsertMenu(
        database,
        {
          id: decision.targetId,
          handle: menu.handle,
          name: menu.name,
          maxDepth: menu.maxDepth,
          items: remapIds(menu.items, idMap) as unknown as NavigationItem[],
        },
        decision.action === "update",
      );
    }
  }
}

async function importEntries(
  database: DatabaseOrTransaction,
  document: LintelExport,
  { decisions, idMap }: ResolvedImport,
  siteFor: (handle: string) => string,
) {
  const collections = await listCollections(database, tenantId);
  const written = document.entries.filter((entry) => shouldWrite(decisions.get(entry.id)));

  for (const entry of written) {
    const decision = decisions.get(entry.id) as Decision;
    const collectionId = collections.find((row) => row.handle === entry.collection)?.id;
    if (!collectionId) {
      continue;
    }
    await upsertEntry(
      database,
      {
        id: decision.targetId,
        collectionId,
        siteId: siteFor(entry.site),
        locale: entry.locale,
        slug: entry.slug,
        status: entry.status,
        publishedAt: entry.publishedAt ? new Date(entry.publishedAt) : null,
        scheduledFor: entry.scheduledFor ? new Date(entry.scheduledFor) : null,
        data: remapIds(entry.data, idMap),
        publishedData: entry.publishedData ? remapIds(entry.publishedData, idMap) : null,
        sortOrder: entry.sortOrder,
        createdAt: new Date(entry.createdAt),
        updatedAt: new Date(entry.updatedAt),
      },
      decision.action === "update",
    );
  }

  // Parents and translations point at other entries, so they go in once every entry is there.
  // A parent or origin that isn't in the export is kept only if this site has it already.
  const existingIds = new Set((await listEntries(database, tenantId)).map((row) => row.id));
  const targetOf = (id: string | null) => {
    const target = id ? (decisions.get(id)?.targetId ?? id) : null;
    return target && existingIds.has(target) ? target : null;
  };
  for (const entry of written) {
    const decision = decisions.get(entry.id) as Decision;
    await linkEntry(database, tenantId, decision.targetId, {
      parentId: targetOf(entry.parentId),
      originId: targetOf(entry.originId),
    });
  }
  await importRevisions(database, written, decisions, idMap);
}

async function importRevisions(
  database: DatabaseOrTransaction,
  entries: LintelExport["entries"],
  decisions: ReadonlyMap<string, Decision>,
  idMap: ReadonlyMap<string, string>,
) {
  const revisions = entries.flatMap((entry) =>
    (entry.revisions ?? []).map((revision) => ({
      id: revision.id,
      entryId: decisions.get(entry.id)?.targetId ?? entry.id,
      action: revision.action,
      data: remapIds(revision.data, idMap),
      createdAt: new Date(revision.createdAt),
    })),
  );
  const existing = await listExistingRevisionIds(
    database,
    revisions.map((revision) => revision.id),
  );
  await insertRevisions(
    database,
    revisions.filter((revision) => !existing.has(revision.id)),
  );
}
