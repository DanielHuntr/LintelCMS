import { describeEntryForEvent } from "../../content-events/entry-event-data.js";
import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import { saveEntry } from "../../entries/entries.service.js";
import { publishEntry, unpublishEntry } from "../../entries/entry-publishing.service.js";
import type { EventCause } from "../../events/event-bus.js";
import { HttpError } from "../../http/http-errors.js";
import { notifyPeople } from "../notifications/notifications.service.js";
import type { ActionStep } from "../workflow-definition.schema.js";
import { findWorkflowRow } from "../workflows.repository.js";
import type { WorkflowRunRow } from "../workflows.table.js";
import { ActionFailedError, type ActionResult } from "./action-result.js";
import { sendHttpRequestStep } from "./http-action.js";
import { findRecipientAddresses, findRecipientPeople, readActor } from "./recipients.js";
import type { RunContext } from "./run-context.js";
import { startWorkflowRun } from "./start-runs.js";
import { renderText } from "./templates.js";
import type { WorkflowServices } from "./workflow-services.js";

/** Everything an action step can see: the run, what it knows, and the server's services. */
export interface ActionInput {
  run: WorkflowRunRow;
  secret: string;
  context: RunContext;
  services: WorkflowServices;
  now: Date;
}

/**
 * Does one action step. In a test run nothing on the site changes: content steps say
 * what they would have done, email and notifications go only to the person testing, and
 * HTTP requests are really sent (marked `Lintel-Test: true`) so a developer can try
 * their server.
 */
export async function performAction(step: ActionStep, input: ActionInput): Promise<ActionResult> {
  switch (step.type) {
    case "send_email":
      return sendEmailStep(step, input);
    case "http_request":
      return sendHttpRequestStep(
        step,
        input.context,
        {
          runId: input.run.id,
          stepId: step.id,
          workflowId: input.run.workflowId,
          secret: input.secret,
          isTest: input.run.isTest,
        },
        input.services,
        input.now,
      );
    case "notify_users":
      return notifyStep(step, input);
    case "update_entry_field":
      return updateEntryFieldStep(step, input);
    case "publish_entry":
    case "unpublish_entry":
      return changePublishingStep(step.type, input);
    case "run_workflow":
      return runWorkflowStep(step, input);
    case "wait":
      // Waiting is handled by the run itself (see run-executor.ts).
      return { summary: "Waited" };
  }
}

async function sendEmailStep(
  step: Extract<ActionStep, { type: "send_email" }>,
  { run, context, services }: ActionInput,
): Promise<ActionResult> {
  const testerEmail = readActor(context)?.email;
  const to = run.isTest
    ? testerEmail
      ? [testerEmail]
      : []
    : await findRecipientAddresses(services.database(), step.to, context);
  if (to.length === 0) {
    throw new ActionFailedError("Nobody to send the email to", false);
  }
  const subject = renderText(step.subject, context).replace(/[\r\n]+/g, " ");
  const text = renderText(step.body, context);
  try {
    // One message per person, so nobody sees who else it went to.
    for (const recipient of to) {
      await services.email.send({ to: recipient, subject, text });
    }
  } catch (error) {
    throw new ActionFailedError(`The email couldn't be sent: ${messageOf(error)}`, true);
  }
  return {
    summary: `Sent “${subject}” to ${to.join(", ")}`,
    output: { to, subject },
    detail: { to, subject, text },
  };
}

async function notifyStep(
  step: Extract<ActionStep, { type: "notify_users" }>,
  { run, context, services }: ActionInput,
): Promise<ActionResult> {
  const tester = readActor(context);
  const people = run.isTest
    ? tester
      ? [tester]
      : []
    : await findRecipientPeople(services.database(), step.to, context);
  const message = renderText(step.message, context);
  await notifyPeople(services.database(), people, { message, link: linkForContext(context) });
  const names = people.map((person) => person.name).join(", ");
  return {
    summary: people.length === 0 ? "Nobody to notify" : `Notified ${names}`,
    output: { notified: people.length },
    detail: { message, people: people.map((person) => person.email) },
  };
}

async function updateEntryFieldStep(
  step: Extract<ActionStep, { type: "update_entry_field" }>,
  { run, context, services, now }: ActionInput,
): Promise<ActionResult> {
  const entryId = requireEntryId(context);
  const value = renderText(step.value, context);
  if (run.isTest) {
    return { summary: `In a test run, “${step.field}” isn't changed (it would become “${value}”)` };
  }
  const database = services.database();
  const saved = await asActionFailure(() =>
    saveEntry(
      database,
      entryId,
      { data: { [step.field]: value } },
      { authorId: null, assetExists: services.assetExists },
    ),
  );
  const entry = context.entry as Record<string, unknown>;
  context.entry = { ...entry, fields: saved.data };
  await services.events.publish(
    "entry.updated",
    { entry: await describeEntryForEvent(database, entryId), changedFields: [step.field] },
    { cause: causeOf(run), now },
  );
  return { summary: `Set “${step.field}” to “${value}”`, output: { value } };
}

async function changePublishingStep(
  type: "publish_entry" | "unpublish_entry",
  { run, context, services, now }: ActionInput,
): Promise<ActionResult> {
  const entryId = requireEntryId(context);
  const verb = type === "publish_entry" ? "published" : "unpublished";
  if (run.isTest) {
    return { summary: `In a test run, the entry isn't ${verb}` };
  }
  const database = services.database();
  const changeContext = { authorId: null, assetExists: services.assetExists };
  await asActionFailure(() =>
    type === "publish_entry"
      ? publishEntry(database, entryId, changeContext, now)
      : unpublishEntry(database, entryId, null),
  );
  const entry = await describeEntryForEvent(database, entryId);
  context.entry = { ...(context.entry as Record<string, unknown>), ...entry };
  const name = type === "publish_entry" ? "entry.published" : "entry.unpublished";
  await services.events.publish(name, { entry }, { cause: causeOf(run), now });
  return { summary: `“${entry.title}” was ${verb}`, output: { status: entry.status } };
}

async function runWorkflowStep(
  step: Extract<ActionStep, { type: "run_workflow" }>,
  { run, context, services, now }: ActionInput,
): Promise<ActionResult> {
  const database = services.database();
  const workflow = await findWorkflowRow(database, DEFAULT_TENANT_ID, step.workflowId);
  if (!workflow) {
    throw new ActionFailedError("The workflow to run has been deleted", false);
  }
  if (run.isTest) {
    return { summary: `In a test run, “${workflow.name}” isn't started` };
  }
  if (!workflow.enabled) {
    throw new ActionFailedError(`“${workflow.name}” is switched off`, false);
  }
  // The child starts with what this run knew, but its own steps and workflow.
  const shared = Object.fromEntries(
    Object.entries(context).filter(([key]) => key !== "steps" && key !== "workflow"),
  );
  const child = await asActionFailure(() =>
    startWorkflowRun(database, workflow, {
      context: { ...shared, parentRun: { id: run.id } },
      idempotencyKey: `run:${run.id}:${step.id}`,
      depth: run.depth + 1,
      now,
    }),
  );
  services.runSoon();
  return { summary: `Started “${workflow.name}”`, output: { runId: child.run.id } };
}

function requireEntryId(context: RunContext): string {
  const entry = context.entry;
  const id = typeof entry === "object" && entry !== null ? Reflect.get(entry, "id") : undefined;
  if (typeof id !== "string") {
    throw new ActionFailedError(
      "This workflow wasn't started by an entry, so there is none to change",
      false,
    );
  }
  return id;
}

/** The admin page for what the run is about: the entry to review, say. */
export function linkForContext(context: RunContext): string | null {
  const entry = context.entry;
  if (typeof entry !== "object" || entry === null) return null;
  const id = Reflect.get(entry, "id");
  const collection = Reflect.get(entry, "collection");
  return typeof id === "string" && typeof collection === "string"
    ? `/content/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`
    : null;
}

export function causeOf(run: WorkflowRunRow): EventCause {
  return { workflowRunId: run.id, depth: run.depth };
}

/** Errors meant for people (a missing entry, a field that doesn't accept the value) don't get retried. */
async function asActionFailure<Result>(action: () => Promise<Result>): Promise<Result> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof HttpError || error instanceof ActionFailedError) {
      throw new ActionFailedError(error.message, false);
    }
    if (error instanceof Error && error.name === "RunTooDeepError") {
      throw new ActionFailedError(error.message, false);
    }
    throw error;
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
