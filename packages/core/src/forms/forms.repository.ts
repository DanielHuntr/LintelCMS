import { and, count, eq, max } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import {
  type FormRow,
  formSubmissionsTable as formSubmissionsDefinition,
  formsTable as formsDefinition,
  type NewFormRow,
} from "./forms.table.js";
import { insertReturning } from "../database/dialect/writes.js";
import { tableFor } from "../database/dialect/mysql-tables.js";
import { countWhere } from "../database/dialect/expressions.js";

/** Database reads and writes for forms themselves. Submissions are in their own file. */

export type FormWithCounts = FormRow & {
  submissionCount: number;
  unreadCount: number;
  lastSubmittedAt: Date | null;
};

function selectFormsWithCounts(database: DatabaseOrTransaction) {
  const formSubmissionsTable = tableFor(database, formSubmissionsDefinition);
  const formsTable = tableFor(database, formsDefinition);
  return database
    .select({
      form: formsTable,
      submissionCount: count(formSubmissionsTable.id),
      unreadCount: countWhere(database, eq(formSubmissionsTable.isRead, false)),
      lastSubmittedAt: max(formSubmissionsTable.createdAt),
    })
    .from(formsTable)
    .leftJoin(formSubmissionsTable, eq(formSubmissionsTable.formId, formsTable.id))
    .groupBy(formsTable.id);
}

interface CountedRow {
  form: FormRow;
  submissionCount: number;
  unreadCount: number;
  lastSubmittedAt: Date | string | null;
}

function withCounts(row: CountedRow): FormWithCounts {
  return {
    ...row.form,
    submissionCount: row.submissionCount,
    unreadCount: row.unreadCount,
    lastSubmittedAt: row.lastSubmittedAt ? new Date(row.lastSubmittedAt) : null,
  };
}

export async function listFormRows(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<FormWithCounts[]> {
  const formsTable = tableFor(database, formsDefinition);
  const rows = await selectFormsWithCounts(database)
    .where(eq(formsTable.tenantId, tenantId))
    .orderBy(formsTable.name);
  return rows.map(withCounts);
}

export async function findFormRowById(
  database: DatabaseOrTransaction,
  tenantId: string,
  formId: string,
): Promise<FormWithCounts | undefined> {
  const formsTable = tableFor(database, formsDefinition);
  const [row] = await selectFormsWithCounts(database).where(
    and(eq(formsTable.tenantId, tenantId), eq(formsTable.id, formId)),
  );
  return row ? withCounts(row) : undefined;
}

export async function findFormRowByHandle(
  database: DatabaseOrTransaction,
  tenantId: string,
  handle: string,
): Promise<FormRow | undefined> {
  const formsTable = tableFor(database, formsDefinition);
  const [row] = await database
    .select()
    .from(formsTable)
    .where(and(eq(formsTable.tenantId, tenantId), eq(formsTable.handle, handle)))
    .limit(1);
  return row;
}

export async function listFormHandles(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<string[]> {
  const formsTable = tableFor(database, formsDefinition);
  const rows = await database
    .select({ handle: formsTable.handle })
    .from(formsTable)
    .where(eq(formsTable.tenantId, tenantId));
  return rows.map((row) => row.handle);
}

export async function insertFormRow(
  database: DatabaseOrTransaction,
  form: NewFormRow,
): Promise<FormRow> {
  const formsTable = tableFor(database, formsDefinition);
  const [row] = await insertReturning(database, formsTable, form);
  if (!row) {
    throw new Error("Saving the form returned nothing.");
  }
  return row;
}

export async function updateFormRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  formId: string,
  changes: Partial<NewFormRow>,
): Promise<void> {
  const formsTable = tableFor(database, formsDefinition);
  await database
    .update(formsTable)
    .set(changes)
    .where(and(eq(formsTable.tenantId, tenantId), eq(formsTable.id, formId)));
}

export async function deleteFormRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  formId: string,
): Promise<void> {
  const formsTable = tableFor(database, formsDefinition);
  await database
    .delete(formsTable)
    .where(and(eq(formsTable.tenantId, tenantId), eq(formsTable.id, formId)));
}
