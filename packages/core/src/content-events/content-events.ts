import type { FastifyInstance } from "fastify";
import type { EventActor, LintelEvents } from "../events/event-catalogue.js";

/**
 * Things that happen to content, announced by routes (and the scheduler) after the
 * change is saved. They go out on the event bus (src/events), where webhooks, SEO and
 * automations listen; src/events/event-listeners.ts is the list of who listens.
 */
export type ContentEvent = {
  [Name in ContentEventName]: { name: Name } & LintelEvents[Name];
}[ContentEventName];

type ContentEventName =
  | "entry.created"
  | "entry.updated"
  | "entry.published"
  | "entry.unpublished"
  | "entry.deleted"
  | "entry.moved"
  | "asset.uploaded"
  | "asset.deleted";

/**
 * Tells every listener. The change has already been saved, so a listener failing is
 * logged by the bus rather than turned into an error for the person who made the change.
 * `actor` is who made the change; leave it out for the scheduler.
 */
export async function announceContentEvent(
  server: FastifyInstance,
  event: ContentEvent,
  actor: EventActor | null = null,
): Promise<void> {
  const { name, ...data } = event;
  // Each member of ContentEvent is its name plus exactly that event's data.
  await server.events.publish(name, data as LintelEvents[typeof name], { actor });
}
