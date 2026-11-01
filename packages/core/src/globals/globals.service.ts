import { checkFieldDefinitions } from "../blueprints/blueprint-fields.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { createContentReferences } from "../entries/entry-references.js";
import { buildEntryDataValidator } from "../fieldtypes/entry-data-validator.js";
import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";
import type { AssetExists } from "../fieldtypes/image-assets.js";
import { resolveLocale } from "../sites/locales.service.js";
import type { Site } from "../sites/sites.table.js";
import { GlobalSetHandleTakenError, GlobalSetNotFoundError } from "./globals.errors.js";
import {
  deleteGlobalSetRow,
  findGlobalSetByHandle,
  insertGlobalSetIfMissing,
  listGlobalSetRows,
  updateGlobalSetRow,
} from "./global-sets.repository.js";
import { findGlobalValues, upsertGlobalValues } from "./global-values.repository.js";
import type {
  CreateGlobalSetRequest,
  GlobalSetResponse,
  GlobalSetSummaryResponse,
  SaveGlobalValuesRequest,
  UpdateGlobalSetRequest,
} from "./globals.schema.js";
import type { GlobalSet } from "./globals.table.js";

/**
 * Business rules for global sets: site-wide fields such as the footer text. Values are
 * kept per language; a language with nothing saved shows the main language's values, and
 * saving it for the first time starts from them.
 *
 * The sets and their fields are shared by every site; each site keeps its own values. The
 * functions that read or save values take the site last, meaning the default when left out.
 */

export function describeGlobalSetSummary(globalSet: GlobalSet): GlobalSetSummaryResponse {
  return {
    id: globalSet.id,
    handle: globalSet.handle,
    name: globalSet.name,
    fieldCount: globalSet.fields.length,
    updatedAt: globalSet.updatedAt.toISOString(),
  };
}

export async function listGlobalSets(
  database: DatabaseOrTransaction,
): Promise<{ globals: GlobalSetSummaryResponse[] }> {
  const globalSets = await listGlobalSetRows(database, DEFAULT_TENANT_ID);
  return { globals: globalSets.map(describeGlobalSetSummary) };
}

export async function findGlobalSetOrFail(
  database: DatabaseOrTransaction,
  handle: string,
): Promise<GlobalSet> {
  const globalSet = await findGlobalSetByHandle(database, DEFAULT_TENANT_ID, handle);
  if (!globalSet) {
    throw new GlobalSetNotFoundError(handle);
  }
  return globalSet;
}

/** The values a site shows in a language: its own, or else its main language's, or else none. */
export async function findValuesForLocale(
  database: DatabaseOrTransaction,
  globalSetId: string,
  site: Site,
  locale: string,
): Promise<{ data: Record<string, unknown>; hasOwnValues: boolean }> {
  const defaultLocale = site.locale;
  const rows = await findGlobalValues(database, globalSetId, site.id, [locale, defaultLocale]);
  const own = rows.find((row) => row.locale === locale);
  const fallback = rows.find((row) => row.locale === defaultLocale);
  return { data: own?.data ?? fallback?.data ?? {}, hasOwnValues: own !== undefined };
}

export async function findGlobalSet(
  database: DatabaseOrTransaction,
  handle: string,
  requestedLocale: string | undefined,
  forSite?: Site,
): Promise<GlobalSetResponse> {
  const globalSet = await findGlobalSetOrFail(database, handle);
  const { site, locale } = await resolveLocale(database, requestedLocale, forSite);
  const values = await findValuesForLocale(database, globalSet.id, site, locale);
  return { ...describeGlobalSetSummary(globalSet), fields: globalSet.fields, locale, ...values };
}

export async function createGlobalSet(
  database: DatabaseOrTransaction,
  request: CreateGlobalSetRequest,
): Promise<GlobalSetResponse> {
  const fields = checkFieldDefinitions(request.fields);
  const inserted = await insertGlobalSetIfMissing(database, {
    handle: request.handle,
    name: request.name,
    fields,
  });
  if (!inserted) {
    throw new GlobalSetHandleTakenError(request.handle);
  }
  return findGlobalSet(database, inserted.handle, undefined);
}

/** Saved values for removed fields are dropped the next time the values are saved. */
export async function updateGlobalSet(
  database: DatabaseOrTransaction,
  handle: string,
  request: UpdateGlobalSetRequest,
): Promise<GlobalSetResponse> {
  const globalSet = await findGlobalSetOrFail(database, handle);
  const fields = checkFieldDefinitions(request.fields);
  await updateGlobalSetRow(database, globalSet.id, { name: request.name, fields });
  return findGlobalSet(database, handle, undefined);
}

export interface GlobalChangeContext {
  authorId: string | null;
  assetExists: AssetExists;
}

/** Checks the values like an entry's, and puts them live straight away. */
export async function saveGlobalValues(
  database: DatabaseOrTransaction,
  handle: string,
  requestedLocale: string | undefined,
  request: SaveGlobalValuesRequest,
  context: GlobalChangeContext,
  forSite?: Site,
): Promise<GlobalSetResponse> {
  const globalSet = await findGlobalSetOrFail(database, handle);
  const { site, locale } = await resolveLocale(database, requestedLocale, forSite);
  const current = await findValuesForLocale(database, globalSet.id, site, locale);
  const validate = buildEntryDataValidator(globalSet.fields, {
    assetExists: context.assetExists,
    references: createContentReferences(database),
  });
  const data = await validate({ ...current.data, ...request.data });
  await upsertGlobalValues(database, {
    globalSetId: globalSet.id,
    siteId: site.id,
    locale,
    data,
    updatedBy: context.authorId,
  });
  return findGlobalSet(database, handle, locale, site);
}

export async function deleteGlobalSet(
  database: DatabaseOrTransaction,
  handle: string,
): Promise<void> {
  const globalSet = await findGlobalSetOrFail(database, handle);
  await deleteGlobalSetRow(database, globalSet.id);
}

export interface GlobalSetDefaults {
  handle: string;
  name: string;
  fields: FieldDefinition[];
}

/** Makes sure a global set with this handle exists. An existing one is left as it is. */
export async function ensureGlobalSet(
  database: DatabaseOrTransaction,
  defaults: GlobalSetDefaults,
): Promise<void> {
  await insertGlobalSetIfMissing(database, {
    handle: defaults.handle,
    name: defaults.name,
    fields: checkFieldDefinitions(defaults.fields),
  });
}
