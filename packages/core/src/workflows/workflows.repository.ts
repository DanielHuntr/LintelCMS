import { and, asc, eq, inArray } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import { type NewWorkflowRow, type WorkflowRow, workflowsTable } from "./workflows.table.js";

/** Database reads and writes for workflows, nothing else. */

export async function listWorkflowRows(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<WorkflowRow[]> {
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
  return database
    .select()
    .from(workflowsTable)
    .where(and(eq(workflowsTable.tenantId, tenantId), inArray(workflowsTable.purpose, purposes)));
}

export async function insertWorkflow(
  database: DatabaseOrTransaction,
  workflow: NewWorkflowRow,
): Promise<WorkflowRow> {
  const [inserted] = await database.insert(workflowsTable).values(workflow).returning();
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
  const [updated] = await database
    .update(workflowsTable)
    .set(changes)
    .where(eq(workflowsTable.id, workflowId))
    .returning();
  return updated;
}

export async function deleteWorkflowRow(
  database: DatabaseOrTransaction,
  workflowId: string,
): Promise<void> {
  await database.delete(workflowsTable).where(eq(workflowsTable.id, workflowId));
}
