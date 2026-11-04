import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../database/client.js";
import { usersTable as usersDefinition } from "../../users/users.table.js";
import {
  type ApprovalStatus,
  type WorkflowApprovalRow,
  workflowApprovalsTable as workflowApprovalsDefinition,
} from "../workflows.table.js";
import { insertIfNewReturning, updateReturning } from "../../database/dialect/writes.js";
import { tableFor } from "../../database/dialect/mysql-tables.js";

/** Database reads and writes for approval requests, nothing else. */

export async function insertApprovalUnlessDuplicate(
  database: DatabaseOrTransaction,
  approval: typeof workflowApprovalsDefinition.$inferInsert,
): Promise<WorkflowApprovalRow> {
  const workflowApprovalsTable = tableFor(database, workflowApprovalsDefinition);
  const [inserted] = await insertIfNewReturning(database, workflowApprovalsTable, approval, {
    target: [workflowApprovalsTable.runId, workflowApprovalsTable.stepId],
  });
  if (inserted) {
    return inserted;
  }
  const [existing] = await database
    .select()
    .from(workflowApprovalsTable)
    .where(
      and(
        eq(workflowApprovalsTable.runId, approval.runId),
        eq(workflowApprovalsTable.stepId, approval.stepId),
      ),
    )
    .limit(1);
  if (!existing) {
    throw new Error("The approval request could not be saved.");
  }
  return existing;
}

export async function findApprovalRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  approvalId: string,
): Promise<WorkflowApprovalRow | undefined> {
  const workflowApprovalsTable = tableFor(database, workflowApprovalsDefinition);
  const [approval] = await database
    .select()
    .from(workflowApprovalsTable)
    .where(
      and(eq(workflowApprovalsTable.tenantId, tenantId), eq(workflowApprovalsTable.id, approvalId)),
    )
    .limit(1);
  return approval;
}

/** Records the answer, only while the request is still pending. Returns it if it won. */
export async function decideApprovalRow(
  database: DatabaseOrTransaction,
  approvalId: string,
  decision: {
    status: Exclude<ApprovalStatus, "pending">;
    decidedBy: string | null;
    comment: string | null;
    decidedAt: Date;
  },
): Promise<WorkflowApprovalRow | undefined> {
  const workflowApprovalsTable = tableFor(database, workflowApprovalsDefinition);
  const [decided] = await updateReturning(
    database,
    workflowApprovalsTable,
    decision,
    and(eq(workflowApprovalsTable.id, approvalId), eq(workflowApprovalsTable.status, "pending")),
  );
  return decided;
}

export async function listPendingApprovalRows(
  database: DatabaseOrTransaction,
  tenantId: string,
  roles: string[] | "every role",
): Promise<WorkflowApprovalRow[]> {
  const workflowApprovalsTable = tableFor(database, workflowApprovalsDefinition);
  const conditions = [
    eq(workflowApprovalsTable.tenantId, tenantId),
    eq(workflowApprovalsTable.status, "pending"),
  ];
  if (roles !== "every role") {
    if (roles.length === 0) return [];
    conditions.push(inArray(workflowApprovalsTable.role, roles));
  }
  return database
    .select()
    .from(workflowApprovalsTable)
    .where(and(...conditions))
    .orderBy(desc(workflowApprovalsTable.createdAt));
}

/** An entry's approval requests, oldest first, with who asked and who answered. */
export async function listApprovalRowsForEntry(
  database: DatabaseOrTransaction,
  tenantId: string,
  entryId: string,
): Promise<(WorkflowApprovalRow & { decidedByName: string | null })[]> {
  const usersTable = tableFor(database, usersDefinition);
  const workflowApprovalsTable = tableFor(database, workflowApprovalsDefinition);
  const rows = await database
    .select({ approval: workflowApprovalsTable, decidedByName: usersTable.name })
    .from(workflowApprovalsTable)
    .leftJoin(usersTable, eq(usersTable.id, workflowApprovalsTable.decidedBy))
    .where(
      and(
        eq(workflowApprovalsTable.tenantId, tenantId),
        eq(workflowApprovalsTable.entryId, entryId),
      ),
    )
    .orderBy(asc(workflowApprovalsTable.createdAt));
  return rows.map((row) => ({ ...row.approval, decidedByName: row.decidedByName }));
}
