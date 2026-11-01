/**
 * The shapes the workflow API sends and takes (see packages/core/src/workflows). Kept
 * here, as the other admin features do, so the admin builds without the server's code.
 */

export type Recipients =
  { type: "role"; role: string } | { type: "actor" } | { type: "addresses"; addresses: string };

export type Condition =
  | { type: "field_equals"; field: string; value: string }
  | { type: "field_contains"; field: string; value: string }
  | { type: "field_changed"; field: string }
  | { type: "collection_is"; collections: string[] }
  | { type: "user_role"; roles: string[] }
  | { type: "value_equals"; left: string; right: string };

export type ConditionType = Condition["type"];

export interface HttpHeader {
  name: string;
  value: string;
}

export type ActionStep =
  | { id: string; type: "send_email"; to: Recipients; subject: string; body: string }
  | {
      id: string;
      type: "http_request";
      url: string;
      method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
      headers: HttpHeader[];
      body: string;
      sign: boolean;
      timeoutSeconds: number;
    }
  | { id: string; type: "update_entry_field"; field: string; value: string }
  | { id: string; type: "publish_entry" }
  | { id: string; type: "unpublish_entry" }
  | { id: string; type: "notify_users"; to: Recipients; message: string }
  | { id: string; type: "wait"; amount: number; unit: "minutes" | "hours" | "days" }
  | { id: string; type: "run_workflow"; workflowId: string };

export interface ConditionStep {
  id: string;
  type: "condition";
  match: "all" | "any";
  conditions: Condition[];
  then: WorkflowStep[];
  otherwise: WorkflowStep[];
}

export interface ApprovalStep {
  id: string;
  type: "approval";
  role: string;
  message: string;
  expiresAfterDays: number | null;
  then: WorkflowStep[];
  otherwise: WorkflowStep[];
}

export type WorkflowStep = ActionStep | ConditionStep | ApprovalStep;
export type StepType = WorkflowStep["type"];
export type BranchingStep = ConditionStep | ApprovalStep;

export type Trigger =
  | { type: "event"; event: string; collections: string[] }
  | { type: "schedule"; cron: string }
  | { type: "manual" };

export type RunStatus = "queued" | "running" | "waiting" | "succeeded" | "failed" | "cancelled";

export interface RunSummary {
  id: string;
  workflowId: string;
  workflowName: string;
  status: RunStatus;
  isTest: boolean;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface StepLog {
  id: string;
  stepId: string;
  stepType: string;
  status: "succeeded" | "failed" | "skipped" | "waiting" | "retrying";
  summary: string;
  detail: Record<string, unknown> | null;
  attempt: number;
  createdAt: string;
}

export interface RunDetail extends RunSummary {
  context: Record<string, unknown>;
  logs: StepLog[];
  nextRunAt: string | null;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: Trigger;
  steps: WorkflowStep[];
  secret: string;
  purpose: string | null;
  createdAt: string;
  updatedAt: string;
  lastRun: RunSummary | null;
}

/** What is saved: a workflow without what the server works out. */
export interface WorkflowDraft {
  name: string;
  description: string;
  enabled: boolean;
  trigger: Trigger;
  steps: WorkflowStep[];
}

export interface EventDefinition {
  name: string;
  label: string;
  group: string;
  sampleData: Record<string, unknown>;
}

export interface Catalogue {
  events: EventDefinition[];
  roles: { handle: string; name: string }[];
}

export interface Notification {
  id: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface EntryReview {
  required: boolean;
  state: "not_submitted" | "in_review" | "approved" | "changes_requested";
  changedSinceApproval: boolean;
  reviewerRole: string | null;
  reviewerRoleName: string | null;
  pendingApprovalId: string | null;
  canReview: boolean;
  canSkipReview: boolean;
  history: {
    kind: "submitted" | "approved" | "changes_requested" | "expired";
    by: string | null;
    comment: string;
    at: string;
  }[];
}

export interface ContentApprovalSetting {
  collection: string;
  collectionName: string;
  required: boolean;
  reviewerRole: string;
  publishWhenApproved: boolean;
  workflowId: string | null;
}
