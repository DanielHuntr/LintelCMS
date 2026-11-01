import { z } from "zod";
import { stepsSchema, triggerSchema } from "./workflow-definition.schema.js";
import { approvalStatuses, stepLogStatuses, workflowRunStatuses } from "./workflows.table.js";

/** Requests and responses for the workflow routes. The definition itself is in workflow-definition.schema.ts. */

const nameSchema = z
  .string({ error: "Please give the workflow a name" })
  .trim()
  .min(1, { error: "Please give the workflow a name" })
  .max(120, { error: "Names can be at most 120 characters" });

const descriptionSchema = z
  .string()
  .trim()
  .max(500, { error: "Descriptions can be at most 500 characters" });

export const createWorkflowRequestSchema = z.object({
  name: nameSchema,
  description: descriptionSchema.default(""),
  enabled: z.boolean().default(true),
  trigger: triggerSchema,
  steps: stepsSchema,
});

export const updateWorkflowRequestSchema = z.object({
  name: nameSchema.optional(),
  description: descriptionSchema.optional(),
  enabled: z.boolean().optional(),
  trigger: triggerSchema.optional(),
  steps: stepsSchema.optional(),
});

export const workflowIdParamsSchema = z.object({ id: z.uuid() });
export const runIdParamsSchema = z.object({ runId: z.uuid() });
export const approvalIdParamsSchema = z.object({ approvalId: z.uuid() });
export const notificationIdParamsSchema = z.object({ notificationId: z.uuid() });

/**
 * `POST /workflows/:id/run`. A test run uses `sampleData` (or the trigger's sample)
 * and changes nothing on the site; a real manual run passes `data` to the steps.
 * `idempotencyKey` makes repeating the same request safe.
 */
export const runWorkflowRequestSchema = z.object({
  test: z.boolean().default(false),
  sampleData: z.record(z.string(), z.unknown()).optional(),
  data: z.record(z.string(), z.unknown()).default({}),
  idempotencyKey: z.string().trim().min(1).max(200).optional(),
});

export const listRunsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export const approvalDecisionRequestSchema = z.object({
  decision: z.enum(["approve", "request_changes"], { error: "Choose approve or request changes" }),
  comment: z.string().max(2000, { error: "Comments can be at most 2000 characters" }).optional(),
});

export const reviewRequestSchema = z.object({
  note: z.string().max(2000, { error: "Notes can be at most 2000 characters" }).default(""),
});

export const contentApprovalSettingRequestSchema = z.object({
  required: z.boolean(),
  reviewerRole: z
    .string()
    .trim()
    .min(1, { error: "Choose who reviews" })
    .max(100)
    .default("super-admin"),
  publishWhenApproved: z.boolean().default(true),
});

export const collectionParamsSchema = z.object({ handle: z.string().min(1).max(100) });

const runSummarySchema = z.object({
  id: z.uuid(),
  workflowId: z.uuid(),
  workflowName: z.string(),
  status: z.enum(workflowRunStatuses),
  isTest: z.boolean(),
  error: z.string().nullable(),
  createdAt: z.string(),
  finishedAt: z.string().nullable(),
});

export const workflowSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string(),
  enabled: z.boolean(),
  trigger: triggerSchema,
  steps: stepsSchema,
  secret: z.string(),
  purpose: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastRun: runSummarySchema.nullable(),
});

export const stepLogSchema = z.object({
  id: z.uuid(),
  stepId: z.string(),
  stepType: z.string(),
  status: z.enum(stepLogStatuses),
  summary: z.string(),
  detail: z.record(z.string(), z.unknown()).nullable(),
  attempt: z.number(),
  createdAt: z.string(),
});

export const runDetailSchema = runSummarySchema.extend({
  context: z.record(z.string(), z.unknown()),
  logs: z.array(stepLogSchema),
  nextRunAt: z.string().nullable(),
});

export const approvalSchema = z.object({
  id: z.uuid(),
  runId: z.uuid(),
  role: z.string(),
  message: z.string(),
  entryId: z.uuid().nullable(),
  status: z.enum(approvalStatuses),
  comment: z.string().nullable(),
  canAnswer: z.boolean(),
  createdAt: z.string(),
  decidedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
});

export const notificationListSchema = z.object({
  unread: z.number(),
  notifications: z.array(
    z.object({
      id: z.uuid(),
      message: z.string(),
      link: z.string().nullable(),
      read: z.boolean(),
      createdAt: z.string(),
    }),
  ),
});

/** Where an entry stands with its review, for the editor's status panel. */
export const entryReviewSchema = z.object({
  required: z.boolean(),
  state: z.enum(["not_submitted", "in_review", "approved", "changes_requested"]),
  /** Saved since it was approved, so it needs approving again. */
  changedSinceApproval: z.boolean(),
  reviewerRole: z.string().nullable(),
  /** The role's name, such as "Editor", for people to read. */
  reviewerRoleName: z.string().nullable(),
  pendingApprovalId: z.uuid().nullable(),
  canReview: z.boolean(),
  /** Whether this person may publish without a review (they may do everything). */
  canSkipReview: z.boolean(),
  history: z.array(
    z.object({
      kind: z.enum(["submitted", "approved", "changes_requested", "expired"]),
      by: z.string().nullable(),
      comment: z.string(),
      at: z.string(),
    }),
  ),
});

export const contentApprovalSettingSchema = z.object({
  collection: z.string(),
  collectionName: z.string(),
  required: z.boolean(),
  reviewerRole: z.string(),
  publishWhenApproved: z.boolean(),
  workflowId: z.uuid().nullable(),
});

export type CreateWorkflowRequest = z.infer<typeof createWorkflowRequestSchema>;
export type UpdateWorkflowRequest = z.infer<typeof updateWorkflowRequestSchema>;
export type RunWorkflowRequest = z.infer<typeof runWorkflowRequestSchema>;
export type WorkflowResponse = z.infer<typeof workflowSchema>;
export type RunSummaryResponse = z.infer<typeof runSummarySchema>;
export type RunDetailResponse = z.infer<typeof runDetailSchema>;
export type ApprovalDecisionRequest = z.infer<typeof approvalDecisionRequestSchema>;
export type ApprovalResponse = z.infer<typeof approvalSchema>;
export type NotificationList = z.infer<typeof notificationListSchema>;
export type EntryReviewResponse = z.infer<typeof entryReviewSchema>;
export type ContentApprovalSetting = z.infer<typeof contentApprovalSettingSchema>;
export type ContentApprovalSettingRequest = z.infer<typeof contentApprovalSettingRequestSchema>;
