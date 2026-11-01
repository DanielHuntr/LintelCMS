import { listBlueprintRows } from "../blueprints/blueprints.repository.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { slugify } from "../entries/slugs.js";
import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";
import { listGlobalSetRows } from "../globals/global-sets.repository.js";
import {
  TaxonomyHandleTakenError,
  TaxonomyInUseError,
  TaxonomyNotFoundError,
} from "./taxonomies.errors.js";
import {
  deleteTaxonomyRow,
  findTaxonomyByHandle,
  findTaxonomyWithCount,
  insertTaxonomyIfMissing,
  listTaxonomiesWithCounts,
  renameTaxonomy,
  type TaxonomyWithCount,
} from "./taxonomies.repository.js";
import type {
  CreateTaxonomyRequest,
  TaxonomyResponse,
  UpdateTaxonomyRequest,
} from "./taxonomies.schema.js";
import type { Taxonomy } from "./taxonomies.table.js";
import { forgetTerms } from "./term-references.js";
import { insertTermIfMissing, listTermIdsInTaxonomy } from "./terms.repository.js";

/** Business rules for taxonomies. Terms are in terms.service.ts. */

export function describeTaxonomy(taxonomy: TaxonomyWithCount): TaxonomyResponse {
  return {
    id: taxonomy.id,
    handle: taxonomy.handle,
    name: taxonomy.name,
    termCount: taxonomy.termCount,
    updatedAt: taxonomy.updatedAt.toISOString(),
  };
}

export async function listTaxonomies(
  database: DatabaseOrTransaction,
): Promise<{ taxonomies: TaxonomyResponse[] }> {
  const taxonomies = await listTaxonomiesWithCounts(database, DEFAULT_TENANT_ID);
  return { taxonomies: taxonomies.map(describeTaxonomy) };
}

export async function findTaxonomy(
  database: DatabaseOrTransaction,
  handle: string,
): Promise<TaxonomyResponse> {
  const taxonomy = await findTaxonomyWithCount(database, DEFAULT_TENANT_ID, handle);
  if (!taxonomy) {
    throw new TaxonomyNotFoundError(handle);
  }
  return describeTaxonomy(taxonomy);
}

/** The stored taxonomy, or a 404 that names the handle. */
export async function findTaxonomyOrFail(
  database: DatabaseOrTransaction,
  handle: string,
): Promise<Taxonomy> {
  const taxonomy = await findTaxonomyByHandle(database, DEFAULT_TENANT_ID, handle);
  if (!taxonomy) {
    throw new TaxonomyNotFoundError(handle);
  }
  return taxonomy;
}

export async function createTaxonomy(
  database: DatabaseOrTransaction,
  request: CreateTaxonomyRequest,
): Promise<TaxonomyResponse> {
  const inserted = await insertTaxonomyIfMissing(database, request);
  if (!inserted) {
    throw new TaxonomyHandleTakenError(request.handle);
  }
  return describeTaxonomy({ ...inserted, termCount: 0 });
}

export async function updateTaxonomy(
  database: DatabaseOrTransaction,
  handle: string,
  request: UpdateTaxonomyRequest,
): Promise<TaxonomyResponse> {
  const taxonomy = await findTaxonomyOrFail(database, handle);
  await renameTaxonomy(database, taxonomy.id, request.name);
  return findTaxonomy(database, handle);
}

/**
 * Deletes the taxonomy and its terms, and takes the terms out of every entry. Refused while
 * a content type or global set has a field choosing from it, since that field would break.
 */
export async function deleteTaxonomy(
  database: DatabaseOrTransaction,
  handle: string,
): Promise<void> {
  const taxonomy = await findTaxonomyOrFail(database, handle);
  const usedBy = await findNamesUsingTaxonomy(database, handle);
  if (usedBy.length > 0) {
    throw new TaxonomyInUseError(taxonomy.name, usedBy);
  }
  await database.transaction(async (transaction) => {
    await forgetTerms(transaction, await listTermIdsInTaxonomy(transaction, taxonomy.id));
    await deleteTaxonomyRow(transaction, taxonomy.id);
  });
}

/** The names of content types and global sets with a terms field for this taxonomy. */
async function findNamesUsingTaxonomy(
  database: DatabaseOrTransaction,
  handle: string,
): Promise<string[]> {
  const usesTaxonomy = (fields: readonly FieldDefinition[]) =>
    fields.some((field) => field.type === "terms" && field.options.taxonomy === handle);
  const blueprints = await listBlueprintRows(database, DEFAULT_TENANT_ID);
  const globalSets = await listGlobalSetRows(database, DEFAULT_TENANT_ID);
  return [...blueprints, ...globalSets]
    .filter((owner) => usesTaxonomy(owner.fields))
    .map((owner) => owner.name);
}

export interface TaxonomyDefaults {
  handle: string;
  name: string;
  /** Titles of the terms a new taxonomy starts with. */
  terms: readonly string[];
}

/**
 * Makes sure a taxonomy with this handle exists. A new one gets its starting terms; an
 * existing one is left exactly as it is, so terms someone deleted don't come back.
 */
export async function ensureTaxonomy(
  database: DatabaseOrTransaction,
  defaults: TaxonomyDefaults,
): Promise<void> {
  const created = await insertTaxonomyIfMissing(database, {
    handle: defaults.handle,
    name: defaults.name,
  });
  if (!created) {
    return;
  }
  for (const title of defaults.terms) {
    await insertTermIfMissing(database, { taxonomyId: created.id, title, slug: slugify(title) });
  }
}
