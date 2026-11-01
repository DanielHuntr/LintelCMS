import { z } from "zod";
import { isValidCron } from "./engine/cron.js";

/**
 * What a workflow is: one trigger, then steps run top to bottom. Conditions and
 * approvals branch into two lists of steps of their own. Every step has an `id` unique
 * within its workflow, which the run log and templates (`{{steps.<id>.status}}`) use.
 *
 * Stored as JSON on the workflow and copied onto every run when it starts, so editing a
 * workflow never changes a run already under way.
 */

const handleSchema = z
  .string({ error: "Please choose one" })
  .trim()
  .min(1, { error: "Please choose one" })
  .max(100);

const templateText = (maximum: number) =>
  z
    .string({ error: "This should be text" })
    .max(maximum, { error: `This can be at most ${maximum} characters` });

const stepIdSchema = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,39}$/, {
  error: "Step ids start with a letter and use letters, numbers, - and _",
});

// Triggers

export const eventTriggerSchema = z.object({
  type: z.literal("event"),
  event: z.string().regex(/^[a-z_]+\.[a-z_]+$/, { error: "Choose what starts this workflow" }),
  /** Only entries in these collections (by handle). Empty means every collection. */
  collections: z.array(handleSchema).max(50).default([]),
});

export const scheduleTriggerSchema = z.object({
  type: z.literal("schedule"),
  /** Five-field cron, in UTC: "0 9 * * 1" is every Monday at 09:00. */
  cron: z.string().trim().refine(isValidCron, {
    error: "The schedule should be five parts, like 0 9 * * 1 for Mondays at 9:00",
  }),
});

export const manualTriggerSchema = z.object({ type: z.literal("manual") });

export const triggerSchema = z.discriminatedUnion(
  "type",
  [eventTriggerSchema, scheduleTriggerSchema, manualTriggerSchema],
  { error: "Choose what starts this workflow" },
);

// Conditions

export const conditionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("field_equals"), field: handleSchema, value: templateText(1000) }),
  z.object({ type: z.literal("field_contains"), field: handleSchema, value: templateText(1000) }),
  z.object({ type: z.literal("field_changed"), field: handleSchema }),
  z.object({ type: z.literal("collection_is"), collections: z.array(handleSchema).min(1) }),
  z.object({ type: z.literal("user_role"), roles: z.array(handleSchema).min(1) }),
  /** For developers: any template value, such as a response from an HTTP step. */
  z.object({
    type: z.literal("value_equals"),
    left: templateText(1000),
    right: templateText(1000),
  }),
]);

// Who receives an email or a notification

export const recipientsSchema = z.discriminatedUnion("type", [
  /** Everyone with this role. */
  z.object({ type: z.literal("role"), role: handleSchema }),
  /** The person whose action started the run. */
  z.object({ type: z.literal("actor") }),
  /** Email addresses, separated by commas. Templates allowed: "{{submission.fields.email}}". */
  z.object({ type: z.literal("addresses"), addresses: templateText(1000).min(1) }),
]);

// Steps

const headerSchema = z.object({
  name: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{1,100}$/, { error: "Header names use letters, numbers and dashes" }),
  value: templateText(2000),
});

const actionSteps = [
  z.object({
    id: stepIdSchema,
    type: z.literal("send_email"),
    to: recipientsSchema,
    subject: templateText(300).min(1, { error: "Please write a subject" }),
    body: templateText(20_000),
  }),
  z.object({
    id: stepIdSchema,
    type: z.literal("http_request"),
    url: templateText(2000).min(1, { error: "Please enter the address to call" }),
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("POST"),
    headers: z.array(headerSchema).max(20).default([]),
    /**
     * A JSON template. Placeholders go inside strings: `"title": "{{entry.title}}"`, and a
     * string that is only a placeholder keeps the value's type: `"entry": "{{entry}}"`.
     * Empty sends the whole run context.
     */
    body: templateText(20_000).default(""),
    /** Sign with the workflow's secret, in the Lintel-Signature header. */
    sign: z.boolean().default(true),
    timeoutSeconds: z.number().int().min(1).max(30).default(10),
  }),
  z.object({
    id: stepIdSchema,
    type: z.literal("update_entry_field"),
    field: handleSchema,
    value: templateText(20_000),
  }),
  z.object({ id: stepIdSchema, type: z.literal("publish_entry") }),
  z.object({ id: stepIdSchema, type: z.literal("unpublish_entry") }),
  z.object({
    id: stepIdSchema,
    type: z.literal("notify_users"),
    to: recipientsSchema,
    message: templateText(1000).min(1, { error: "Please write the message" }),
  }),
  z.object({
    id: stepIdSchema,
    type: z.literal("wait"),
    amount: z.number().int().min(1).max(1000),
    unit: z.enum(["minutes", "hours", "days"]),
  }),
  z.object({ id: stepIdSchema, type: z.literal("run_workflow"), workflowId: z.uuid() }),
] as const;

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
  /** The role whose members may approve. Super admins always may. */
  role: string;
  message: string;
  /** Without an answer after this many days, the request counts as declined. */
  expiresAfterDays: number | null;
  /** The steps when approved. */
  then: WorkflowStep[];
  /** The steps when changes are requested (or the request expires). */
  otherwise: WorkflowStep[];
}

export type ActionStep = z.infer<(typeof actionSteps)[number]>;
export type WorkflowStep = ActionStep | ConditionStep | ApprovalStep;

// Recursive, so the branching steps' types are written out once above and checked here.
const conditionStepSchema: z.ZodType<ConditionStep> = z.object({
  id: stepIdSchema,
  type: z.literal("condition"),
  match: z.enum(["all", "any"]).default("all"),
  conditions: z.array(conditionSchema).min(1, { error: "Add at least one condition" }).max(20),
  get then() {
    return stepListSchema;
  },
  get otherwise() {
    return stepListSchema;
  },
}) as z.ZodType<ConditionStep>;

const approvalStepSchema: z.ZodType<ApprovalStep> = z.object({
  id: stepIdSchema,
  type: z.literal("approval"),
  role: handleSchema,
  message: templateText(1000).default(""),
  expiresAfterDays: z.number().int().min(1).max(90).nullable().default(null),
  get then() {
    return stepListSchema;
  },
  get otherwise() {
    return stepListSchema;
  },
}) as z.ZodType<ApprovalStep>;

export const stepSchema: z.ZodType<WorkflowStep> = z.lazy(() =>
  z.union([...actionSteps, conditionStepSchema, approvalStepSchema], {
    error: "That step isn't one Lintel knows",
  }),
);

const stepListSchema: z.ZodType<WorkflowStep[]> = z.lazy(() =>
  z.array(stepSchema).max(100, { error: "A workflow can have at most 100 steps" }).default([]),
) as z.ZodType<WorkflowStep[]>;

export const stepsSchema = stepListSchema;

export type Trigger = z.infer<typeof triggerSchema>;
export type EventTrigger = z.infer<typeof eventTriggerSchema>;
export type Condition = z.infer<typeof conditionSchema>;
export type Recipients = z.infer<typeof recipientsSchema>;
export type WorkflowStepType = WorkflowStep["type"];

/** Every step in the workflow, branches included, in reading order. */
export function listAllSteps(steps: readonly WorkflowStep[]): WorkflowStep[] {
  return steps.flatMap((step) =>
    step.type === "condition" || step.type === "approval"
      ? [step, ...listAllSteps(step.then), ...listAllSteps(step.otherwise)]
      : [step],
  );
}

/** The ids used more than once, which would mix up the run log. */
export function findDuplicateStepIds(steps: readonly WorkflowStep[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const step of listAllSteps(steps)) {
    if (seen.has(step.id)) duplicates.add(step.id);
    seen.add(step.id);
  }
  return [...duplicates];
}
