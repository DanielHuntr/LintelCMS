import { type StringKey, t } from "../i18n/strings.js";
import type {
  Condition,
  EventDefinition,
  Recipients,
  Trigger,
  Workflow,
  WorkflowStep,
} from "./workflows.types.js";

/**
 * Plain-English sentences for triggers and steps: "When an entry is published in Blog
 * posts", "Send an email to everyone with the editor role: “New post”". The builder's
 * cards and its summary line read from here.
 */

export interface DescribeContext {
  events: readonly EventDefinition[];
  /** Collection names by handle, so "posts" reads "Blog posts". */
  collectionNames: Readonly<Record<string, string>>;
  workflows: readonly Pick<Workflow, "id" | "name">[];
}

export const schedulePresets = [
  { cron: "0 * * * *", label: "trigger.preset.hourly" },
  { cron: "0 9 * * *", label: "trigger.preset.daily" },
  { cron: "0 9 * * 1", label: "trigger.preset.weekly" },
  { cron: "0 9 1 * *", label: "trigger.preset.monthly" },
] as const satisfies readonly { cron: string; label: StringKey }[];

const knownEvents: Record<string, StringKey> = {
  "entry.created": "event.entry.created",
  "entry.updated": "event.entry.updated",
  "entry.published": "event.entry.published",
  "entry.unpublished": "event.entry.unpublished",
  "entry.deleted": "event.entry.deleted",
  "entry.review_requested": "event.entry.review_requested",
  "asset.uploaded": "event.asset.uploaded",
  "asset.deleted": "event.asset.deleted",
  "form.submitted": "event.form.submitted",
  "user.invited": "event.user.invited",
};

/** "an entry is published"; events from plugins use the label they declared. */
export function describeEvent(eventName: string, events: readonly EventDefinition[]): string {
  const known = knownEvents[eventName];
  if (known) return t(known);
  const declared = events.find((event) => event.name === eventName);
  if (declared) return declared.label.charAt(0).toLowerCase() + declared.label.slice(1);
  return t("trigger.describe.unknownEvent", { event: eventName });
}

export function describeTrigger(trigger: Trigger, context: DescribeContext): string {
  if (trigger.type === "manual") return t("trigger.describe.manual");
  if (trigger.type === "schedule") {
    const preset = schedulePresets.find((candidate) => candidate.cron === trigger.cron);
    return preset
      ? t("trigger.describe.schedule", { schedule: t(preset.label) })
      : t("trigger.describe.cron", { cron: trigger.cron });
  }
  const event = describeEvent(trigger.event, context.events);
  if (trigger.collections.length === 0) return t("trigger.describe.event", { event });
  return t("trigger.describe.eventIn", {
    event,
    collections: listOr(
      trigger.collections.map((handle) => context.collectionNames[handle] ?? handle),
    ),
  });
}

export function describeStep(step: WorkflowStep, context: DescribeContext): string {
  switch (step.type) {
    case "send_email":
      return t("describe.send_email", { who: describeRecipients(step.to), subject: step.subject });
    case "http_request":
      return t("describe.http_request", { url: step.url || "…", method: step.method });
    case "update_entry_field":
      return t("describe.update_entry_field", { field: step.field || "…", value: step.value });
    case "publish_entry":
      return t("describe.publish_entry");
    case "unpublish_entry":
      return t("describe.unpublish_entry");
    case "notify_users":
      return t("describe.notify_users", {
        who: describeRecipients(step.to),
        message: step.message,
      });
    case "wait":
      return t("describe.wait", {
        amount: step.amount,
        unit: describeUnit(step.unit, step.amount),
      });
    case "run_workflow": {
      const workflow = context.workflows.find((candidate) => candidate.id === step.workflowId);
      return workflow
        ? t("describe.run_workflow", { name: workflow.name })
        : t("describe.run_workflowUnknown");
    }
    case "condition":
      return t("describe.condition", {
        conditions: step.conditions
          .map((condition) => describeCondition(condition, context))
          .join(t(step.match === "all" ? "describe.and" : "describe.or")),
      });
    case "approval":
      return t("describe.approval", { role: step.role });
  }
}

export function describeRecipients(recipients: Recipients): string {
  if (recipients.type === "role") return t("describe.who.role", { role: recipients.role });
  if (recipients.type === "actor") return t("describe.who.actor");
  return t("describe.who.addresses", { addresses: recipients.addresses || "…" });
}

export function describeCondition(condition: Condition, context: DescribeContext): string {
  switch (condition.type) {
    case "field_equals":
    case "field_contains":
      return t(`describe.${condition.type}`, {
        field: condition.field || "…",
        value: condition.value,
      });
    case "field_changed":
      return t("describe.field_changed", { field: condition.field || "…" });
    case "collection_is":
      return t("describe.collection_is", {
        collections: listOr(
          condition.collections.map((handle) => context.collectionNames[handle] ?? handle),
        ),
      });
    case "user_role":
      return t("describe.user_role", { roles: listOr(condition.roles) });
    case "value_equals":
      return t("describe.value_equals", { left: condition.left, right: condition.right });
  }
}

/** "When a form is submitted → Send an email to …", for the list and the builder. */
export function summariseWorkflow(
  workflow: Pick<Workflow, "trigger" | "steps">,
  context: DescribeContext,
): string {
  const [first] = workflow.steps;
  const trigger = describeTrigger(workflow.trigger, context);
  return first ? `${trigger} → ${describeStep(first, context)}` : trigger;
}

function describeUnit(unit: "minutes" | "hours" | "days", amount: number): string {
  return t(amount === 1 ? `describe.unit.${unit}.one` : `describe.unit.${unit}`);
}

function listOr(items: readonly string[]): string {
  return items.join(t("describe.or"));
}
