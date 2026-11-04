import { and, asc, eq } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import {
  type Fieldset,
  fieldsetsTable as fieldsetsDefinition,
  type NewFieldset,
} from "./fieldsets.table.js";
import { insertIfNewReturning } from "../database/dialect/writes.js";
import { tableFor } from "../database/dialect/mysql-tables.js";

/** Database reads and writes for fieldsets, nothing else. */

export async function listFieldsetRows(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<Fieldset[]> {
  const fieldsetsTable = tableFor(database, fieldsetsDefinition);
  return database
    .select()
    .from(fieldsetsTable)
    .where(eq(fieldsetsTable.tenantId, tenantId))
    .orderBy(asc(fieldsetsTable.name));
}

export async function findFieldsetByHandle(
  database: DatabaseOrTransaction,
  tenantId: string,
  handle: string,
): Promise<Fieldset | undefined> {
  const fieldsetsTable = tableFor(database, fieldsetsDefinition);
  const [fieldset] = await database
    .select()
    .from(fieldsetsTable)
    .where(and(eq(fieldsetsTable.tenantId, tenantId), eq(fieldsetsTable.handle, handle)))
    .limit(1);
  return fieldset;
}

/** Inserts the fieldset unless one with its handle exists; returns undefined if it did. */
export async function insertFieldsetIfMissing(
  database: DatabaseOrTransaction,
  fieldset: NewFieldset,
): Promise<Fieldset | undefined> {
  const fieldsetsTable = tableFor(database, fieldsetsDefinition);
  const [inserted] = await insertIfNewReturning(database, fieldsetsTable, fieldset, {
    target: [fieldsetsTable.tenantId, fieldsetsTable.handle],
  });
  return inserted;
}

export async function updateFieldsetRow(
  database: DatabaseOrTransaction,
  fieldsetId: string,
  changes: Pick<Fieldset, "name" | "fields">,
): Promise<void> {
  const fieldsetsTable = tableFor(database, fieldsetsDefinition);
  await database
    .update(fieldsetsTable)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(fieldsetsTable.id, fieldsetId));
}

export async function deleteFieldsetRow(
  database: DatabaseOrTransaction,
  fieldsetId: string,
): Promise<void> {
  const fieldsetsTable = tableFor(database, fieldsetsDefinition);
  await database.delete(fieldsetsTable).where(eq(fieldsetsTable.id, fieldsetId));
}
