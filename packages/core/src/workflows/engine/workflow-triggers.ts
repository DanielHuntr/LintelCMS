import type { DatabaseOrTransaction } from "../../database/client.js";
import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import type { AnyPublishedEvent } from "../../events/event-bus.js";
import { findEnabledPluginIds } from "../../plugins/plugins.service.js";
import type { EventTrigger } from "../workflow-definition.schema.js";
import { listEnabledWorkflowRows } from "../workflows.repository.js";
import type { WorkflowRow } from "../workflows.table.js";
import { matchesCron } from "./cron.js";
import { buildEventContext } from "./run-context.js";
import { MAXIMUM_RUN_DEPTH, startWorkflowRun } from "./start-runs.js";

/** The plugin that switches automations on (see src/plugins). */
export const AUTOMATIONS_PLUGIN_ID = "automations";

export async function automationsAreOn(database: DatabaseOrTransaction): Promise<boolean> {
  return (await findEnabledPluginIds(database)).includes(AUTOMATIONS_PLUGIN_ID);
}

/**
 * Starts a run of every switched-on workflow the event triggers. Keyed by the event's
 * id, so an event told twice still starts each workflow once. Returns how many started.
 */
export async function startRunsForEvent(
  database: DatabaseOrTransaction,
  event: AnyPublishedEvent,
): Promise<number> {
  const depth = event.cause ? event.cause.depth + 1 : 0;
  if (depth > MAXIMUM_RUN_DEPTH || !(await automationsAreOn(database))) {
    return 0;
  }
  const workflows = (await listEnabledWorkflowRows(database, DEFAULT_TENANT_ID)).filter(
    (workflow) => isTriggeredBy(workflow, event),
  );
  if (workflows.length === 0) {
    return 0;
  }
  const context = await buildEventContext(database, event);
  let started = 0;
  for (const workflow of workflows) {
    const result = await startWorkflowRun(database, workflow, {
      context,
      idempotencyKey: `event:${event.id}`,
      depth,
      startedBy: event.actor?.id ?? null,
    });
    if (result.started) started += 1;
  }
  return started;
}

function isTriggeredBy(workflow: WorkflowRow, event: AnyPublishedEvent): boolean {
  const trigger = workflow.trigger;
  if (trigger.type !== "event" || trigger.event !== event.name) {
    return false;
  }
  return matchesCollections(trigger, event.data as Record<string, unknown>);
}

/** No collections chosen means any; events without an entry aren't filtered. */
function matchesCollections(trigger: EventTrigger, data: Record<string, unknown>): boolean {
  if (trigger.collections.length === 0) {
    return true;
  }
  const entry = data.entry;
  if (typeof entry !== "object" || entry === null) {
    return true;
  }
  return trigger.collections.includes(String(Reflect.get(entry, "collection")));
}

/**
 * Starts scheduled workflows whose schedule matches this minute or the one before (the
 * scheduler ticks about once a minute and may be a little late). Keyed by the minute,
 * so several servers, or two ticks in one minute, start each run once.
 */
export async function startScheduledRuns(
  database: DatabaseOrTransaction,
  now: Date,
): Promise<number> {
  if (!(await automationsAreOn(database))) {
    return 0;
  }
  const workflows = (await listEnabledWorkflowRows(database, DEFAULT_TENANT_ID)).filter(
    (workflow) => workflow.trigger.type === "schedule",
  );
  const thisMinute = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
  const minutes = [new Date(thisMinute.getTime() - 60_000), thisMinute];
  let started = 0;
  for (const workflow of workflows) {
    if (workflow.trigger.type !== "schedule") continue;
    for (const minute of minutes) {
      // A workflow made or changed after that minute shouldn't catch up on it.
      if (minute < new Date(Math.floor(workflow.updatedAt.getTime() / 60_000) * 60_000)) continue;
      if (!matchesCron(workflow.trigger.cron, minute)) continue;
      const result = await startWorkflowRun(database, workflow, {
        context: {
          event: { id: null, name: "schedule", occurredAt: minute.toISOString() },
          actor: null,
        },
        idempotencyKey: `schedule:${minute.toISOString()}`,
        now,
      });
      if (result.started) started += 1;
    }
  }
  return started;
}
