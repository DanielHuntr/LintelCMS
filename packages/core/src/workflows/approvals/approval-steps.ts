import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import { readActor } from "../engine/recipients.js";
import type { RunContext } from "../engine/run-context.js";
import { linkForContext } from "../engine/step-actions.js";
import { renderText, valueAsText, lookUpPath } from "../engine/templates.js";
import type { WorkflowServices } from "../engine/workflow-services.js";
import { notifyPeople } from "../notifications/notifications.service.js";
import type { ApprovalStep } from "../workflow-definition.schema.js";
import { findPeopleByIds, listPeopleWithRole } from "../workflow-people.repository.js";
import type { WorkflowApprovalRow, WorkflowRunRow } from "../workflows.table.js";
import {
  decideApprovalRow,
  findApprovalRow,
  insertApprovalUnlessDuplicate,
} from "./approvals.repository.js";

/** The role every install has, whose members may answer any approval. */
export const SUPER_ADMIN_ROLE_HANDLE = "super-admin";

/**
 * The approval step, as the engine runs it: ask, then on a later pass read the answer.
 * Asking writes the request down and tells everyone who can answer (the role's members,
 * or the super admins when the role has nobody, so a request is never lost).
 */
export async function requestApproval(
  services: WorkflowServices,
  run: WorkflowRunRow,
  step: ApprovalStep,
  context: RunContext,
  now: Date,
): Promise<WorkflowApprovalRow> {
  const database = services.database();
  const message = renderText(step.message, context);
  const approval = await insertApprovalUnlessDuplicate(database, {
    tenantId: DEFAULT_TENANT_ID,
    runId: run.id,
    stepId: step.id,
    role: step.role,
    message,
    entryId: run.entryId,
    requestedBy: readActor(context)?.id ?? null,
    expiresAt:
      step.expiresAfterDays === null
        ? null
        : new Date(now.getTime() + step.expiresAfterDays * 86_400_000),
  });
  const members = await listPeopleWithRole(database, DEFAULT_TENANT_ID, step.role);
  const people =
    members.length > 0
      ? members
      : await listPeopleWithRole(database, DEFAULT_TENANT_ID, SUPER_ADMIN_ROLE_HANDLE);
  const requester = readActor(context);
  const title = valueAsText(lookUpPath(context, "entry.title")) || run.workflowName;
  await notifyPeople(
    database,
    people.filter((person) => person.id !== requester?.id),
    {
      message: message || `${requester?.name ?? "Someone"} asked for your approval: “${title}”`,
      link: linkForContext(context) ?? "/automations/approvals",
    },
  );
  return approval;
}

export type ApprovalOutcome =
  | { decision: "pending"; expiresAt: Date | null }
  | {
      decision: "approved" | "changes_requested" | "expired";
      comment: string;
      decidedBy: string;
      summary: string;
    };

/** Where an approval request stands; one past its expiry is closed as expired. */
export async function readApprovalOutcome(
  services: WorkflowServices,
  approvalId: string,
  now: Date,
): Promise<ApprovalOutcome> {
  const database = services.database();
  let approval = await findApprovalRow(database, DEFAULT_TENANT_ID, approvalId);
  if (!approval) {
    throw new Error("The approval request for this run has gone.");
  }
  if (approval.status === "pending") {
    if (!approval.expiresAt || approval.expiresAt > now) {
      return { decision: "pending", expiresAt: approval.expiresAt };
    }
    approval =
      (await decideApprovalRow(database, approval.id, {
        status: "expired",
        decidedBy: null,
        comment: null,
        decidedAt: now,
      })) ?? approval;
  }
  const [decider] = await findPeopleByIds(database, approval.decidedBy ? [approval.decidedBy] : []);
  const decidedBy = decider?.name ?? "";
  const comment = approval.comment ?? "";
  if (approval.status === "approved") {
    return { decision: "approved", comment, decidedBy, summary: `Approved by ${decidedBy}` };
  }
  if (approval.status === "rejected") {
    return {
      decision: "changes_requested",
      comment,
      decidedBy,
      summary: `${decidedBy} asked for changes${comment ? `: “${comment}”` : ""}`,
    };
  }
  return { decision: "expired", comment, decidedBy, summary: "Nobody answered in time" };
}
