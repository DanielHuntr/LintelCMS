import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../database/client.js";
import { usersTable } from "../../users/users.table.js";
import {
  type ApprovalStatus,
  type WorkflowApprovalRow,
  workflowApprovalsTable,
} from "../workflows.table.js";

/** Database reads and writes for approval requests, nothing else. */

export async function insertApprovalUnlessDuplicate(
  database: DatabaseOrTransaction,
  approval: typeof workflowApprovalsTable.$inferInsert,
): Promise<WorkflowApprovalRow> {
  const [inserted] = await database
    .insert(workflowApprovalsTable)
    .values(approval)
    .onConflictDoNothing({ target: [workflowApprovalsTable.runId, workflowApprovalsTable.stepId] })
    .returning();
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
  const [decided] = await database
    .update(workflowApprovalsTable)
    .set(decision)
    .where(
      and(eq(workflowApprovalsTable.id, approvalId), eq(workflowApprovalsTable.status, "pending")),
    )
    .returning();
  return decided;
}

export async function listPendingApprovalRows(
  database: DatabaseOrTransaction,
  tenantId: string,
  roles: string[] | "every role",
): Promise<WorkflowApprovalRow[]> {
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
