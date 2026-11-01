import { listCollectionNamesUsingBlueprint } from "../collections/collections.repository.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { isUniqueViolation } from "../database/database-errors.js";
import { fillFieldsetImports } from "../fieldsets/fieldsets.service.js";
import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";
import { checkBlueprintFields } from "./blueprint-fields.js";
import {
  BlueprintHandleTakenError,
  BlueprintInUseError,
  BlueprintNotFoundError,
} from "./blueprints.errors.js";
import {
  deleteBlueprintRow,
  findBlueprintByHandle,
  findBlueprintById,
  insertBlueprint,
  insertBlueprintIfMissing,
  listBlueprintRows,
  updateBlueprintFields,
} from "./blueprints.repository.js";
import type {
  BlueprintResponse,
  CreateBlueprintRequest,
  UpdateBlueprintRequest,
} from "./blueprints.schema.js";
import type { Blueprint } from "./blueprints.table.js";

/** Business rules for blueprints (content types). Field rules are in blueprint-fields.ts. */

export function describeBlueprint(blueprint: Blueprint): BlueprintResponse {
  return {
    id: blueprint.id,
    handle: blueprint.handle,
    name: blueprint.name,
    kind: blueprint.kind,
    fields: blueprint.fields,
    version: blueprint.version,
    updatedAt: blueprint.updatedAt.toISOString(),
  };
}

export async function listBlueprints(
  database: DatabaseOrTransaction,
): Promise<{ blueprints: BlueprintResponse[] }> {
  const blueprints = await listBlueprintRows(database, DEFAULT_TENANT_ID);
  return { blueprints: blueprints.map(describeBlueprint) };
}

/** The stored blueprint, or a 404 that names the handle. */
export async function findBlueprintOrFail(
  database: DatabaseOrTransaction,
  handle: string,
): Promise<Blueprint> {
  const blueprint = await findBlueprintByHandle(database, DEFAULT_TENANT_ID, handle);
  if (!blueprint) {
    throw new BlueprintNotFoundError(handle);
  }
  return blueprint;
}

/** The blueprint a collection points at. A missing one means the database was edited by hand. */
export async function findBlueprintByIdOrFail(
  database: DatabaseOrTransaction,
  blueprintId: string,
): Promise<Blueprint> {
  const blueprint = await findBlueprintById(database, blueprintId);
  if (!blueprint) {
    throw new Error(`The blueprint ${blueprintId} is missing.`);
  }
  return blueprint;
}

export async function createBlueprint(
  database: DatabaseOrTransaction,
  request: CreateBlueprintRequest,
): Promise<BlueprintResponse> {
  const fields = checkBlueprintFields(await fillFieldsetImports(database, request.fields));
  if (await findBlueprintByHandle(database, DEFAULT_TENANT_ID, request.handle)) {
    throw new BlueprintHandleTakenError(request.handle);
  }

  try {
    const blueprint = await insertBlueprint(database, {
      handle: request.handle,
      name: request.name,
      kind: "entry",
      fields,
    });
    return describeBlueprint(blueprint);
  } catch (error) {
    // Someone else created the same handle between the check and the insert.
    if (isUniqueViolation(error)) {
      throw new BlueprintHandleTakenError(request.handle);
    }
    throw error;
  }
}

/**
 * Replaces the name and fields and bumps the version. Existing entries keep their values;
 * values for removed fields are dropped the next time each entry is saved.
 */
export async function updateBlueprint(
  database: DatabaseOrTransaction,
  handle: string,
  request: UpdateBlueprintRequest,
): Promise<BlueprintResponse> {
  const blueprint = await findBlueprintOrFail(database, handle);
  const fields = checkBlueprintFields(await fillFieldsetImports(database, request.fields));
  const updated = await updateBlueprintFields(database, blueprint.id, {
    name: request.name,
    fields,
  });
  return describeBlueprint(updated);
}

/** Refuses while a collection uses the blueprint, since its entries would lose their fields. */
export async function deleteBlueprint(
  database: DatabaseOrTransaction,
  handle: string,
): Promise<void> {
  const blueprint = await findBlueprintOrFail(database, handle);
  const usedBy = await listCollectionNamesUsingBlueprint(database, blueprint.id);
  if (usedBy.length > 0) {
    throw new BlueprintInUseError(handle, usedBy);
  }
  await deleteBlueprintRow(database, blueprint.id);
}

export interface BlueprintDefaults {
  handle: string;
  name: string;
  fields: FieldDefinition[];
}

/**
 * The blueprint with this handle, creating it from `defaults` if there is none. An
 * existing blueprint is returned as it is, even if someone has changed its fields since.
 */
export async function ensureBlueprint(
  database: DatabaseOrTransaction,
  defaults: BlueprintDefaults,
): Promise<Blueprint> {
  const existing = await findBlueprintByHandle(database, DEFAULT_TENANT_ID, defaults.handle);
  if (existing) {
    return existing;
  }
  const fields = checkBlueprintFields(defaults.fields);
  const inserted = await insertBlueprintIfMissing(database, { ...defaults, kind: "entry", fields });
  return inserted ?? findBlueprintOrFail(database, defaults.handle);
}
