import { and, asc, eq } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import { type Fieldset, fieldsetsTable, type NewFieldset } from "./fieldsets.table.js";

/** Database reads and writes for fieldsets, nothing else. */

export async function listFieldsetRows(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<Fieldset[]> {
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
  const [inserted] = await database
    .insert(fieldsetsTable)
    .values(fieldset)
    .onConflictDoNothing({ target: [fieldsetsTable.tenantId, fieldsetsTable.handle] })
    .returning();
  return inserted;
}

export async function updateFieldsetRow(
  database: DatabaseOrTransaction,
  fieldsetId: string,
  changes: Pick<Fieldset, "name" | "fields">,
): Promise<void> {
  await database
    .update(fieldsetsTable)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(fieldsetsTable.id, fieldsetId));
}

export async function deleteFieldsetRow(
  database: DatabaseOrTransaction,
  fieldsetId: string,
): Promise<void> {
  await database.delete(fieldsetsTable).where(eq(fieldsetsTable.id, fieldsetId));
}
