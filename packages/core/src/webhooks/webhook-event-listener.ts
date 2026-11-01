import type { FastifyInstance } from "fastify";
import type { AnyPublishedEvent } from "../events/event-bus.js";
import { queueWebhookEvent } from "./webhook-deliveries.service.js";

/**
 * Webhooks hear about events through the event bus (src/events): every event a webhook
 * can ask for is written down for each webhook that wants it, then sent in the
 * background. The payload keeps the shape webhooks have always had.
 */
export function subscribeWebhooksToEvents(server: FastifyInstance): void {
  server.events.onEvery("webhooks", async (event) => {
    const data = webhookDataFor(event);
    if (!data) {
      return;
    }
    const queued = await queueWebhookEvent(
      server.database,
      data.name,
      data.payload,
      new Date(event.occurredAt),
    );
    if (queued > 0) {
      server.webhooks.deliverSoon();
    }
  });
}

/** What a webhook is sent for an event, or undefined for events webhooks don't offer. */
function webhookDataFor(event: AnyPublishedEvent) {
  switch (event.name) {
    case "entry.published":
    case "entry.unpublished":
    case "entry.deleted":
      return { name: event.name, payload: { entry: event.data.entry } };
    case "asset.uploaded":
    case "asset.deleted":
      return { name: event.name, payload: { asset: event.data.asset } };
    default:
      return undefined;
  }
}
