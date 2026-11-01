import type { DatabaseOrTransaction } from "../../database/client.js";
import { findEntryById } from "../../entries/entries.repository.js";
import type { AnyPublishedEvent } from "../../events/event-bus.js";
import type { EventActor } from "../../events/event-catalogue.js";
import { listRoleHandlesForUser } from "../workflow-people.repository.js";

/**
 * What a run's templates and conditions can read. For an event-started run:
 *
 *   {
 *     event: { id, name, occurredAt },
 *     entry: { id, collection, slug, title, url, status, publishedAt, fields: {...} },
 *     asset | form | submission | user ...: the event's own data,
 *     actor: { id, name, email, roles } or null,
 *     workflow: { id, name }, run: { id, isTest },
 *     steps: { <stepId>: what that step produced },
 *   }
 *
 * The entry's `fields` are its saved values when the run started.
 */
export type RunContext = Record<string, unknown>;

export async function buildEventContext(
  database: DatabaseOrTransaction,
  event: AnyPublishedEvent,
): Promise<RunContext> {
  const data = event.data as Record<string, unknown>;
  const context: RunContext = {
    ...data,
    event: { id: event.id, name: event.name, occurredAt: event.occurredAt },
    actor: await describeActor(database, event.actor),
  };
  if (isEntryData(data.entry)) {
    context.entry = await withEntryFields(database, data.entry);
  }
  return context;
}

/** Sample data (from the builder's test run) gets the same shape as a real event. */
export async function buildSampleContext(
  database: DatabaseOrTransaction,
  eventName: string,
  sampleData: Record<string, unknown>,
  actor: EventActor,
  now: Date,
): Promise<RunContext> {
  const entry = isEntryData(sampleData.entry) ? sampleData.entry : undefined;
  return {
    ...sampleData,
    event: { id: "test", name: eventName, occurredAt: now.toISOString() },
    actor: await describeActor(database, actor),
    ...(entry ? { entry: { fields: { title: entry.title }, ...entry } } : {}),
  };
}

export async function describeActor(
  database: DatabaseOrTransaction,
  actor: EventActor | null,
): Promise<Record<string, unknown> | null> {
  if (!actor) {
    return null;
  }
  return { ...actor, roles: await listRoleHandlesForUser(database, actor.id) };
}

async function withEntryFields(
  database: DatabaseOrTransaction,
  entry: { id: string },
): Promise<Record<string, unknown>> {
  const stored = await findEntryById(database, entry.id);
  return { ...entry, fields: stored?.data ?? {} };
}

function isEntryData(value: unknown): value is { id: string; title: string } {
  return (
    typeof value === "object" && value !== null && typeof Reflect.get(value, "id") === "string"
  );
}

/** The entry a run is about, if its context has one with a real id. */
export function entryIdFromContext(context: RunContext): string | null {
  const entry = context.entry;
  if (!isEntryData(entry)) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entry.id)
    ? entry.id
    : null;
}
