import type { SignedIn } from "../../auth/auth.schema.js";
import type { DatabaseOrTransaction } from "../../database/client.js";
import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import { wakeRun } from "../engine/workflow-runs.repository.js";
import { listRoleHandlesForUser } from "../workflow-people.repository.js";
import {
  ApprovalAlreadyAnsweredError,
  ApprovalNotFoundError,
  CommentNeededError,
  NotAnApproverError,
} from "../workflows.errors.js";
import type { ApprovalDecisionRequest, ApprovalResponse } from "../workflows.schema.js";
import type { WorkflowApprovalRow } from "../workflows.table.js";
import {
  decideApprovalRow,
  findApprovalRow,
  listPendingApprovalRows,
} from "./approvals.repository.js";

/**
 * Answering approval requests. Anyone with the request's role may answer, and so may
 * anyone who may do everything. Answering wakes the run, which takes the "approved" or
 * "changes requested" branch.
 */
export async function decideApproval(
  database: DatabaseOrTransaction,
  approvalId: string,
  signedIn: SignedIn,
  request: ApprovalDecisionRequest,
  now = new Date(),
): Promise<ApprovalResponse> {
  const approval = await findApprovalRow(database, DEFAULT_TENANT_ID, approvalId);
  if (!approval) {
    throw new ApprovalNotFoundError();
  }
  if (!(await mayAnswer(database, signedIn, approval.role))) {
    throw new NotAnApproverError(approval.role);
  }
  const comment = request.comment?.trim() ?? "";
  if (request.decision === "request_changes" && comment === "") {
    throw new CommentNeededError();
  }
  const decided = await decideApprovalRow(database, approval.id, {
    status: request.decision === "approve" ? "approved" : "rejected",
    decidedBy: signedIn.user.id,
    comment: comment || null,
    decidedAt: now,
  });
  if (!decided) {
    throw new ApprovalAlreadyAnsweredError();
  }
  await wakeRun(database, decided.runId, now);
  return describeApproval(decided, true);
}

/** The requests this person can answer, newest first. */
export async function listApprovalsForPerson(
  database: DatabaseOrTransaction,
  signedIn: SignedIn,
): Promise<{ approvals: ApprovalResponse[] }> {
  const roles = signedIn.permissions.includes("*")
    ? "every role"
    : await listRoleHandlesForUser(database, signedIn.user.id);
  const rows = await listPendingApprovalRows(database, DEFAULT_TENANT_ID, roles);
  return { approvals: rows.map((row) => describeApproval(row, true)) };
}

export async function mayAnswer(
  database: DatabaseOrTransaction,
  signedIn: Pick<SignedIn, "user" | "permissions">,
  role: string,
): Promise<boolean> {
  if (signedIn.permissions.includes("*")) {
    return true;
  }
  return (await listRoleHandlesForUser(database, signedIn.user.id)).includes(role);
}

export function describeApproval(row: WorkflowApprovalRow, canAnswer: boolean): ApprovalResponse {
  return {
    id: row.id,
    runId: row.runId,
    role: row.role,
    message: row.message,
    entryId: row.entryId,
    status: row.status,
    comment: row.comment,
    canAnswer: canAnswer && row.status === "pending",
    createdAt: row.createdAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
  };
}
