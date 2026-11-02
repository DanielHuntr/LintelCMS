import { checkBlueprintFields, checkFieldDefinitions } from "../blueprints/blueprint-fields.js";
import { listBlueprintRows, updateBlueprintFields } from "../blueprints/blueprints.repository.js";
import { type FieldRename, moveRenamedFieldValues } from "../entries/field-renames.service.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";
import { listGlobalSetRows, updateGlobalSetRow } from "../globals/global-sets.repository.js";
import { InvalidFieldsError } from "../http/http-errors.js";
import {
  type FieldsetFields,
  nestedFieldsetProblem,
  usesFieldset,
  withFieldsetFields,
} from "./fieldset-imports.js";
import {
  FieldsetHandleTakenError,
  FieldsetInUseError,
  FieldsetNotFoundError,
} from "./fieldsets.errors.js";
import {
  deleteFieldsetRow,
  findFieldsetByHandle,
  insertFieldsetIfMissing,
  listFieldsetRows,
  updateFieldsetRow,
} from "./fieldsets.repository.js";
import type {
  CreateFieldsetRequest,
  FieldsetResponse,
  UpdateFieldsetRequest,
} from "./fieldsets.schema.js";
import type { Fieldset } from "./fieldsets.table.js";

/**
 * Business rules for fieldsets: saved sets of fields reused through Fieldset fields. When a
 * fieldset changes, every content type and global set using it gets the new fields straight
 * away, the same as if someone had saved each of them; values already in entries stay put
 * and are checked against the new fields the next time each entry is saved.
 */

export async function listFieldsets(
  database: DatabaseOrTransaction,
): Promise<{ fieldsets: FieldsetResponse[] }> {
  const [fieldsets, users] = await Promise.all([
    listFieldsetRows(database, DEFAULT_TENANT_ID),
    listFieldsetUsers(database),
  ]);
  return { fieldsets: fieldsets.map((fieldset) => describeFieldset(fieldset, users)) };
}

export async function findFieldset(
  database: DatabaseOrTransaction,
  handle: string,
): Promise<FieldsetResponse> {
  const fieldset = await findFieldsetOrFail(database, handle);
  return describeFieldset(fieldset, await listFieldsetUsers(database));
}

export async function createFieldset(
  database: DatabaseOrTransaction,
  request: CreateFieldsetRequest,
): Promise<FieldsetResponse> {
  const fields = checkFieldsetFields(request.fields);
  const inserted = await insertFieldsetIfMissing(database, {
    handle: request.handle,
    name: request.name,
    fields,
  });
  if (!inserted) {
    throw new FieldsetHandleTakenError(request.handle);
  }
  return findFieldset(database, inserted.handle);
}

export async function updateFieldset(
  database: DatabaseOrTransaction,
  handle: string,
  request: UpdateFieldsetRequest,
): Promise<FieldsetResponse> {
  const fieldset = await findFieldsetOrFail(database, handle);
  const fields = checkFieldsetFields(request.fields);
  await database.transaction(async (transaction) => {
    await updateFieldsetRow(transaction, fieldset.id, { name: request.name, fields });
    await refreshFieldsetUsers(transaction, handle);
    await moveRenamedFieldsetValues(transaction, handle, request.renames ?? [], {
      before: new Set(fieldset.fields.map((field) => field.handle)),
      after: new Set(fields.map((field) => field.handle)),
    });
  });
  return findFieldset(database, handle);
}

/**
 * A fieldset's values sit in a group named by the Fieldset field that imports it (`cta`), so
 * a renamed handle moves inside that group, in every content type that imports the fieldset
 * at its top level. Fieldsets inside groups or blocks, and in global sets, aren't moved yet.
 */
async function moveRenamedFieldsetValues(
  database: DatabaseOrTransaction,
  fieldsetHandle: string,
  renames: readonly FieldRename[],
  handles: { before: ReadonlySet<string>; after: ReadonlySet<string> },
): Promise<void> {
  if (renames.length === 0) return;
  for (const blueprint of await listBlueprintRows(database, DEFAULT_TENANT_ID)) {
    for (const field of blueprint.fields) {
      if (field.type !== "fieldset" || field.options.fieldset !== fieldsetHandle) continue;
      const within = renames.map((rename) => ({ ...rename, within: field.handle }));
      await moveRenamedFieldValues(database, blueprint.id, within, handles);
    }
  }
}

/** Refuses while a content type or global set uses it: their entries would lose the fields. */
export async function deleteFieldset(
  database: DatabaseOrTransaction,
  handle: string,
): Promise<void> {
  const fieldset = await findFieldsetOrFail(database, handle);
  const usedBy = (await listFieldsetUsers(database)).get(handle) ?? [];
  if (usedBy.length > 0) {
    throw new FieldsetInUseError(handle, usedBy);
  }
  await deleteFieldsetRow(database, fieldset.id);
}

/**
 * Fills each Fieldset field's copy of its fieldset's fields, before a content type or global
 * set is checked and saved. A fieldset that doesn't exist is a problem with that field.
 */
export async function fillFieldsetImports(
  database: DatabaseOrTransaction,
  rawFields: readonly unknown[],
): Promise<unknown[]> {
  const { fields, missing } = withFieldsetFields(rawFields, await fieldsetFieldsByHandle(database));
  if (Object.keys(missing).length > 0) {
    throw new InvalidFieldsError(missing);
  }
  return fields;
}

async function fieldsetFieldsByHandle(database: DatabaseOrTransaction): Promise<FieldsetFields> {
  const rows = await listFieldsetRows(database, DEFAULT_TENANT_ID);
  return new Map(rows.map((row) => [row.handle, row.fields]));
}

async function findFieldsetOrFail(
  database: DatabaseOrTransaction,
  handle: string,
): Promise<Fieldset> {
  const fieldset = await findFieldsetByHandle(database, DEFAULT_TENANT_ID, handle);
  if (!fieldset) {
    throw new FieldsetNotFoundError(handle);
  }
  return fieldset;
}

function checkFieldsetFields(input: readonly unknown[]): FieldDefinition[] {
  const problem = nestedFieldsetProblem(input);
  if (problem) {
    throw new InvalidFieldsError({ fields: problem });
  }
  return checkFieldDefinitions(input);
}

/** Gives every content type and global set that uses the fieldset its new fields. */
async function refreshFieldsetUsers(database: DatabaseOrTransaction, handle: string) {
  const fieldsets = await fieldsetFieldsByHandle(database);
  for (const blueprint of await listBlueprintRows(database, DEFAULT_TENANT_ID)) {
    if (usesFieldset(blueprint.fields, handle)) {
      const { fields } = withFieldsetFields(blueprint.fields, fieldsets);
      await updateBlueprintFields(database, blueprint.id, {
        name: blueprint.name,
        fields: checkBlueprintFields(fields),
      });
    }
  }
  for (const globalSet of await listGlobalSetRows(database, DEFAULT_TENANT_ID)) {
    if (usesFieldset(globalSet.fields, handle)) {
      const { fields } = withFieldsetFields(globalSet.fields, fieldsets);
      await updateGlobalSetRow(database, globalSet.id, {
        name: globalSet.name,
        fields: checkFieldDefinitions(fields),
      });
    }
  }
}

/** The names of the content types and global sets using each fieldset, by its handle. */
async function listFieldsetUsers(database: DatabaseOrTransaction): Promise<Map<string, string[]>> {
  const [fieldsets, blueprints, globalSets] = await Promise.all([
    listFieldsetRows(database, DEFAULT_TENANT_ID),
    listBlueprintRows(database, DEFAULT_TENANT_ID),
    listGlobalSetRows(database, DEFAULT_TENANT_ID),
  ]);
  const owners = [...blueprints, ...globalSets];
  return new Map(
    fieldsets.map((fieldset) => [
      fieldset.handle,
      owners
        .filter((owner) => usesFieldset(owner.fields, fieldset.handle))
        .map((owner) => owner.name),
    ]),
  );
}

function describeFieldset(
  fieldset: Fieldset,
  users: ReadonlyMap<string, string[]>,
): FieldsetResponse {
  return {
    id: fieldset.id,
    handle: fieldset.handle,
    name: fieldset.name,
    fields: fieldset.fields,
    usedBy: users.get(fieldset.handle) ?? [],
    updatedAt: fieldset.updatedAt.toISOString(),
  };
}
