import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../database/columns.js";
import { usersTable } from "../users/users.table.js";
import type { Trigger, WorkflowStep } from "./workflow-definition.schema.js";

/**
 * A workflow: a trigger and the steps that follow it (see workflow-definition.schema.ts).
 * `secret` signs its HTTP requests, like a webhook's. `purpose` marks workflows Lintel
 * manages for a feature, such as "content_approval" for one collection's reviews.
 */
export const workflowsTable = pgTable(
  "workflows",
  {
    id: id(),
    tenantId: tenantId(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    enabled: boolean("enabled").notNull().default(true),
    trigger: jsonb("trigger").$type<Trigger>().notNull(),
    steps: jsonb("steps").$type<WorkflowStep[]>().notNull(),
    secret: text("secret").notNull(),
    purpose: text("purpose"),
    createdBy: uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (table) => [index("workflows_tenant_idx").on(table.tenantId)],
);

export const workflowRunStatuses = [
  "queued",
  "running",
  "waiting",
  "succeeded",
  "failed",
  "cancelled",
] as const;
export type WorkflowRunStatus = (typeof workflowRunStatuses)[number];

/** Where one step of a run has got to; kept on the run so it can carry on after a restart. */
export interface StepState {
  status: "done" | "waiting" | "retrying";
  attempts: number;
  /** For conditions and approvals: which branch was taken. */
  branch?: "then" | "otherwise";
  /** What the step produced, for later templates: `{{steps.<id>.status}}`. */
  output?: unknown;
  waitUntil?: string;
  approvalId?: string;
}

/**
 * One run of a workflow. The workflow's trigger and steps are copied in when it starts,
 * so editing the workflow doesn't change runs under way. `context` holds what started
 * it (the event's data, who did it); `stepStates` where each step has got to.
 *
 * - `queued` and `waiting` runs are picked up when `nextRunAt` comes round (a waiting run
 *   with no `nextRunAt` waits for someone to approve).
 * - A run being worked on is `running` until `leaseUntil`; if its server stops, another
 *   takes it over after that.
 * - `idempotencyKey` is unique per workflow, so the same event or the same scheduled
 *   minute never starts a workflow twice.
 */
export const workflowRunsTable = pgTable(
  "workflow_runs",
  {
    id: id(),
    tenantId: tenantId(),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => workflowsTable.id, { onDelete: "cascade" }),
    workflowName: text("workflow_name").notNull(),
    definition: jsonb("definition").$type<{ trigger: Trigger; steps: WorkflowStep[] }>().notNull(),
    status: text("status", { enum: workflowRunStatuses }).notNull().default("queued"),
    context: jsonb("context").$type<Record<string, unknown>>().notNull(),
    stepStates: jsonb("step_states").$type<Record<string, StepState>>().notNull().default({}),
    idempotencyKey: text("idempotency_key"),
    isTest: boolean("is_test").notNull().default(false),
    /** How many runs led to this one; refused past a limit, so workflows can't loop. */
    depth: integer("depth").notNull().default(0),
    /** The entry the run is about, if any, so an entry's reviews can be found. */
    entryId: uuid("entry_id"),
    startedBy: uuid("started_by").references(() => usersTable.id, { onDelete: "set null" }),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    error: text("error"),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    index("workflow_runs_workflow_idx").on(table.workflowId, table.createdAt),
    index("workflow_runs_due_idx").on(table.status, table.nextRunAt),
    index("workflow_runs_entry_idx").on(table.entryId),
    uniqueIndex("workflow_runs_idempotency_unique").on(table.workflowId, table.idempotencyKey),
  ],
);

export const stepLogStatuses = ["succeeded", "failed", "skipped", "waiting", "retrying"] as const;
export type StepLogStatus = (typeof stepLogStatuses)[number];

/** One line of a run's log: a step done, skipped, waiting, or an attempt that failed. */
export const workflowStepLogsTable = pgTable(
  "workflow_step_logs",
  {
    id: id(),
    tenantId: tenantId(),
    runId: uuid("run_id")
      .notNull()
      .references(() => workflowRunsTable.id, { onDelete: "cascade" }),
    stepId: text("step_id").notNull(),
    stepType: text("step_type").notNull(),
    status: text("status", { enum: stepLogStatuses }).notNull(),
    /** One plain sentence: "Sent to 2 people", "Answered 503". */
    summary: text("summary").notNull(),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    attempt: integer("attempt").notNull().default(1),
    /** Order within the run; several lines can share a timestamp. */
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("workflow_step_logs_run_idx").on(table.runId, table.position)],
);

export const approvalStatuses = ["pending", "approved", "rejected", "expired"] as const;
export type ApprovalStatus = (typeof approvalStatuses)[number];

/** A run waiting for someone with `role` to approve or decline. One per run and step. */
export const workflowApprovalsTable = pgTable(
  "workflow_approvals",
  {
    id: id(),
    tenantId: tenantId(),
    runId: uuid("run_id")
      .notNull()
      .references(() => workflowRunsTable.id, { onDelete: "cascade" }),
    stepId: text("step_id").notNull(),
    role: text("role").notNull(),
    message: text("message").notNull().default(""),
    entryId: uuid("entry_id"),
    requestedBy: uuid("requested_by").references(() => usersTable.id, { onDelete: "set null" }),
    status: text("status", { enum: approvalStatuses }).notNull().default("pending"),
    decidedBy: uuid("decided_by").references(() => usersTable.id, { onDelete: "set null" }),
    comment: text("comment"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("workflow_approvals_run_step_unique").on(table.runId, table.stepId),
    index("workflow_approvals_entry_idx").on(table.entryId, table.createdAt),
    index("workflow_approvals_status_idx").on(table.tenantId, table.status),
  ],
);

/** A message for one person in the admin, from a "Notify people" step or a review. */
export const userNotificationsTable = pgTable(
  "user_notifications",
  {
    id: id(),
    tenantId: tenantId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    /** An admin path to open, such as the entry to review. */
    link: text("link"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("user_notifications_user_idx").on(table.userId, table.createdAt)],
);

export type WorkflowRow = typeof workflowsTable.$inferSelect;
export type NewWorkflowRow = typeof workflowsTable.$inferInsert;
export type WorkflowRunRow = typeof workflowRunsTable.$inferSelect;
export type NewWorkflowRunRow = typeof workflowRunsTable.$inferInsert;
export type WorkflowStepLogRow = typeof workflowStepLogsTable.$inferSelect;
export type NewWorkflowStepLogRow = typeof workflowStepLogsTable.$inferInsert;
export type WorkflowApprovalRow = typeof workflowApprovalsTable.$inferSelect;
export type UserNotificationRow = typeof userNotificationsTable.$inferSelect;
