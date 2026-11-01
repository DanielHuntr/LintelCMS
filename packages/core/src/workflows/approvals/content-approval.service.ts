import type { SignedIn } from "../../auth/auth.schema.js";
import {
  findCollectionByIdOrFail,
  findCollectionOrFail,
  listCollections,
} from "../../collections/collections.service.js";
import { describeEntryForEvent } from "../../content-events/entry-event-data.js";
import type { DatabaseOrTransaction } from "../../database/client.js";
import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import { findEntryOrFail } from "../../entries/entries.service.js";
import type { EventBus } from "../../events/event-bus.js";
import type { LintelChecks } from "../../events/event-catalogue.js";
import { listRunRowsForEntry } from "../engine/workflow-runs.repository.js";
import { automationsAreOn } from "../engine/workflow-triggers.js";
import {
  ApprovalNotRequiredError,
  ApprovalRequiredError,
  ReviewAlreadyRequestedError,
} from "../workflows.errors.js";
import { listWorkflowRowsByPurpose, updateWorkflowRow } from "../workflows.repository.js";
import type {
  ContentApprovalSetting,
  ContentApprovalSettingRequest,
  EntryReviewResponse,
} from "../workflows.schema.js";
import { createWorkflow } from "../workflows.service.js";
import type { WorkflowRow } from "../workflows.table.js";
import { listRoles } from "../workflow-people.repository.js";
import { listApprovalRowsForEntry } from "./approvals.repository.js";
import { mayAnswer } from "./approvals.service.js";
import { buildContentApprovalSteps, readContentApprovalSteps } from "./content-approval.steps.js";

/**
 * Content approval: a collection can require entries to be approved before they are
 * published. It is built from an ordinary workflow per collection (purpose
 * "content_approval"), started by "entry.review_requested", whose approval step waits
 * for a reviewer. This file reads and changes those workflows, works out where an
 * entry's review stands, and refuses publishing until it is approved.
 */
export const CONTENT_APPROVAL_PURPOSE = "content_approval";

export async function listContentApprovalSettings(
  database: DatabaseOrTransaction,
): Promise<{ settings: ContentApprovalSetting[] }> {
  const { collections } = await listCollections(database);
  const workflows = await listApprovalWorkflows(database);
  return {
    settings: collections.map((collection) => {
      const workflow = workflowForCollection(workflows, collection.handle);
      const steps = readContentApprovalSteps(workflow?.steps ?? []);
      return {
        collection: collection.handle,
        collectionName: collection.name,
        required: workflow?.enabled ?? false,
        reviewerRole: workflow ? steps.reviewerRole : "super-admin",
        publishWhenApproved: workflow ? steps.publishWhenApproved : true,
        workflowId: workflow?.id ?? null,
      };
    }),
  };
}

/** Switches approval on or off for a collection, making its workflow the first time. */
export async function setContentApproval(
  database: DatabaseOrTransaction,
  collectionHandle: string,
  request: ContentApprovalSettingRequest,
  userId: string,
): Promise<ContentApprovalSetting> {
  const collection = await findCollectionOrFail(database, collectionHandle);
  const existing = workflowForCollection(await listApprovalWorkflows(database), collection.handle);
  const steps = buildContentApprovalSteps(request.reviewerRole, request.publishWhenApproved);
  const workflowId = existing
    ? (await updateWorkflowRow(database, existing.id, { enabled: request.required, steps }))?.id
    : (
        await createWorkflow(
          database,
          {
            name: `Approval for ${collection.name}`,
            description: `${collection.name} are reviewed before they are published.`,
            enabled: request.required,
            trigger: {
              type: "event",
              event: "entry.review_requested",
              collections: [collection.handle],
            },
            steps,
          },
          userId,
          CONTENT_APPROVAL_PURPOSE,
        )
      ).id;
  return {
    collection: collection.handle,
    collectionName: collection.name,
    required: request.required,
    reviewerRole: request.reviewerRole,
    publishWhenApproved: request.publishWhenApproved,
    workflowId: workflowId ?? null,
  };
}

/** The switched-on approval workflow for the collection, while automations are on. */
export async function findActiveApprovalWorkflow(
  database: DatabaseOrTransaction,
  collectionHandle: string,
): Promise<WorkflowRow | undefined> {
  if (!(await automationsAreOn(database))) {
    return undefined;
  }
  const workflow = workflowForCollection(await listApprovalWorkflows(database), collectionHandle);
  return workflow?.enabled ? workflow : undefined;
}

/** Asks for a review: the approval workflow starts from the event this publishes. */
export async function submitForReview(
  database: DatabaseOrTransaction,
  events: EventBus,
  entryId: string,
  note: string,
  signedIn: SignedIn,
): Promise<EntryReviewResponse> {
  const entry = await describeEntryForEvent(database, entryId);
  const workflow = await findActiveApprovalWorkflow(database, entry.collection);
  if (!workflow) {
    throw new ApprovalNotRequiredError();
  }
  const review = await findEntryReview(database, entryId, signedIn);
  if (review.state === "in_review") {
    throw new ReviewAlreadyRequestedError();
  }
  const { user } = signedIn;
  await events.publish(
    "entry.review_requested",
    { entry, note: note.trim() },
    { actor: { id: user.id, name: user.name, email: user.email } },
  );
  return findEntryReview(database, entryId, signedIn);
}

/** Where the entry's review stands, with its history, for the editor's status panel. */
export async function findEntryReview(
  database: DatabaseOrTransaction,
  entryId: string,
  signedIn: Pick<SignedIn, "user" | "permissions">,
): Promise<EntryReviewResponse> {
  const entry = await findEntryOrFail(database, entryId);
  const collection = await findCollectionByIdOrFail(database, entry.collectionId);
  const workflow = await findActiveApprovalWorkflow(database, collection.handle);
  const workflows = await listApprovalWorkflows(database);
  const runs = (
    await listRunRowsForEntry(
      database,
      DEFAULT_TENANT_ID,
      entryId,
      workflows.map((row) => row.id),
    )
  ).filter((run) => !run.isTest);
  const approvals = await listApprovalRowsForEntry(database, DEFAULT_TENANT_ID, entryId);
  const latestRun = runs.at(-1);
  const latestApproval = approvals.filter((approval) => approval.runId === latestRun?.id).at(-1);
  const reviewerRole = workflow ? readContentApprovalSteps(workflow.steps).reviewerRole : null;
  const roles = reviewerRole ? await listRoles(database, DEFAULT_TENANT_ID) : [];
  const reviewerRoleName = roles.find((role) => role.handle === reviewerRole)?.name ?? reviewerRole;
  const stillGoing = latestRun && ["queued", "running", "waiting"].includes(latestRun.status);

  let state: EntryReviewResponse["state"] = "not_submitted";
  let changedSinceApproval = false;
  if (latestApproval?.status === "approved") {
    changedSinceApproval = !sameValues(submittedFields(latestRun?.context), entry.data);
    state = changedSinceApproval ? "not_submitted" : "approved";
  } else if (latestApproval?.status === "rejected") {
    state = "changes_requested";
  } else if (stillGoing) {
    state = "in_review";
  }
  const pending = latestApproval?.status === "pending" ? latestApproval : undefined;

  return {
    required: workflow !== undefined,
    state,
    changedSinceApproval,
    reviewerRole,
    reviewerRoleName,
    pendingApprovalId: pending?.id ?? null,
    canReview: pending ? await mayAnswer(database, signedIn, pending.role) : false,
    canSkipReview: signedIn.permissions.includes("*"),
    history: [
      ...runs.map((run) => ({
        kind: "submitted" as const,
        by: readName(run.context.actor),
        comment: typeof run.context.note === "string" ? run.context.note : "",
        at: run.createdAt.toISOString(),
      })),
      ...approvals.flatMap((approval) =>
        approval.status === "pending" || !approval.decidedAt
          ? []
          : [
              {
                kind:
                  approval.status === "approved"
                    ? ("approved" as const)
                    : approval.status === "rejected"
                      ? ("changes_requested" as const)
                      : ("expired" as const),
                by: approval.decidedByName,
                comment: approval.comment ?? "",
                at: approval.decidedAt.toISOString(),
              },
            ],
      ),
    ].sort((first, second) => first.at.localeCompare(second.at)),
  };
}

/**
 * The publishing check: in a collection that needs approval, only the approved version
 * may be published, except by someone who may do everything (so a site is never stuck).
 */
export async function checkApprovedBeforePublishing(
  database: DatabaseOrTransaction,
  question: LintelChecks["entry.publishing"],
): Promise<void> {
  if (question.permissions.includes("*")) {
    return;
  }
  const workflow = await findActiveApprovalWorkflow(database, question.entry.collection);
  if (!workflow) {
    return;
  }
  const signedIn = { user: question.actor, permissions: question.permissions };
  const review = await findEntryReview(database, question.entry.id, signedIn);
  if (review.state !== "approved") {
    const collection = await findCollectionOrFail(database, question.entry.collection);
    throw new ApprovalRequiredError(collection.name);
  }
}

async function listApprovalWorkflows(database: DatabaseOrTransaction): Promise<WorkflowRow[]> {
  return listWorkflowRowsByPurpose(database, DEFAULT_TENANT_ID, [CONTENT_APPROVAL_PURPOSE]);
}

function workflowForCollection(workflows: WorkflowRow[], handle: string): WorkflowRow | undefined {
  return workflows.find(
    (workflow) =>
      workflow.trigger.type === "event" && workflow.trigger.collections.includes(handle),
  );
}

function submittedFields(context: Record<string, unknown> | undefined): unknown {
  const entry = context?.entry;
  return typeof entry === "object" && entry !== null ? Reflect.get(entry, "fields") : undefined;
}

function sameValues(first: unknown, second: unknown): boolean {
  return JSON.stringify(sortKeys(first)) === JSON.stringify(sortKeys(second));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([first], [second]) => first.localeCompare(second))
        .map(([key, item]) => [key, sortKeys(item)]),
    );
  }
  return value;
}

function readName(actor: unknown): string | null {
  const name = typeof actor === "object" && actor !== null ? Reflect.get(actor, "name") : null;
  return typeof name === "string" ? name : null;
}
