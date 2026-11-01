import type { FastifyInstance } from "fastify";
import { suggestRedirectForMovedEntry } from "../seo/redirect-suggestions.service.js";
import { queueWebhookEvent } from "../webhooks/webhook-deliveries.service.js";
import type { AssetEventData, EntryEventData } from "./entry-event-data.js";

/**
 * Things that happen to content which other features react to. Routes (and the scheduler)
 * announce them after the change is saved; this file is the one visible list of who
 * listens:
 *
 *   - webhooks: every event except "entry.moved" is offered to webhooks (src/webhooks);
 *   - SEO: "entry.moved" suggests a redirect from the old address (src/seo);
 *   - the built-in website: every event empties its rendered pages (src/website).
 */
export type ContentEvent =
  | { name: "entry.published" | "entry.unpublished" | "entry.deleted"; entry: EntryEventData }
  | { name: "asset.uploaded" | "asset.deleted"; asset: AssetEventData }
  /** A live entry's address changed, because its slug or parent changed. */
  | { name: "entry.moved"; entry: EntryEventData; previousUrl: string };

/**
 * Tells every listener. The change has already been saved, so a listener failing is
 * logged rather than turned into an error for the person who made the change.
 */
export async function announceContentEvent(
  server: FastifyInstance,
  event: ContentEvent,
): Promise<void> {
  server.website.renderedPages.clear();
  try {
    if (event.name === "entry.moved") {
      await suggestRedirectForMovedEntry(server.database, event.previousUrl, event.entry);
      return;
    }
    const data = "entry" in event ? { entry: event.entry } : { asset: event.asset };
    const queued = await queueWebhookEvent(server.database, event.name, data);
    if (queued > 0) {
      server.webhooks.deliverSoon();
    }
  } catch (error) {
    server.log.error(error, `Telling other features about ${event.name} failed`);
  }
}
