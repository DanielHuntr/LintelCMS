import { and, asc, eq, inArray } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import {
  type NewWorkflowRow,
  type WorkflowRow,
  workflowsTable as workflowsDefinition,
} from "./workflows.table.js";
import { insertReturning, updateReturning } from "../database/dialect/writes.js";
import { tableFor } from "../database/dialect/mysql-tables.js";

/** Database reads and writes for workflows, nothing else. */

export async function listWorkflowRows(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<WorkflowRow[]> {
  const workflowsTable = tableFor(database, workflowsDefinition);
  return database
    .select()
    .from(workflowsTable)
    .where(eq(workflowsTable.tenantId, tenantId))
    .orderBy(asc(workflowsTable.createdAt), asc(workflowsTable.id));
}

export async function listEnabledWorkflowRows(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<WorkflowRow[]> {
  const workflowsTable = tableFor(database, workflowsDefinition);
  return database
    .select()
    .from(workflowsTable)
    .where(and(eq(workflowsTable.tenantId, tenantId), eq(workflowsTable.enabled, true)))
    .orderBy(asc(workflowsTable.createdAt));
}

export async function findWorkflowRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  workflowId: string,
): Promise<WorkflowRow | undefined> {
  const workflowsTable = tableFor(database, workflowsDefinition);
  const [workflow] = await database
    .select()
    .from(workflowsTable)
    .where(and(eq(workflowsTable.tenantId, tenantId), eq(workflowsTable.id, workflowId)))
    .limit(1);
  return workflow;
}

export async function listWorkflowRowsByPurpose(
  database: DatabaseOrTransaction,
  tenantId: string,
  purposes: string[],
): Promise<WorkflowRow[]> {
  const workflowsTable = tableFor(database, workflowsDefinition);
  return database
    .select()
    .from(workflowsTable)
    .where(and(eq(workflowsTable.tenantId, tenantId), inArray(workflowsTable.purpose, purposes)));
}

export async function insertWorkflow(
  database: DatabaseOrTransaction,
  workflow: NewWorkflowRow,
): Promise<WorkflowRow> {
  const workflowsTable = tableFor(database, workflowsDefinition);
  const [inserted] = await insertReturning(database, workflowsTable, workflow);
  if (!inserted) {
    throw new Error("The database did not return the new workflow.");
  }
  return inserted;
}

export async function updateWorkflowRow(
  database: DatabaseOrTransaction,
  workflowId: string,
  changes: Partial<NewWorkflowRow>,
): Promise<WorkflowRow | undefined> {
  const workflowsTable = tableFor(database, workflowsDefinition);
  const [updated] = await updateReturning(
    database,
    workflowsTable,
    changes,
    eq(workflowsTable.id, workflowId),
  );
  return updated;
}

export async function deleteWorkflowRow(
  database: DatabaseOrTransaction,
  workflowId: string,
): Promise<void> {
  const workflowsTable = tableFor(database, workflowsDefinition);
  await database.delete(workflowsTable).where(eq(workflowsTable.id, workflowId));
}
