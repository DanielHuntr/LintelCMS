import type { FastifyInstance } from "fastify";
import { suggestRedirectForMovedEntry } from "../seo/redirect-suggestions.service.js";
import { subscribeWebhooksToEvents } from "../webhooks/webhook-event-listener.js";

/**
 * Who listens to which events, in one visible list:
 *
 *   - webhooks: every event a webhook can ask for (src/webhooks);
 *   - SEO: "entry.moved" suggests a redirect from the old address (src/seo);
 *   - automations: every event, to start the workflows it triggers. They subscribe in
 *     `registerWorkflows` (src/workflows), which also declares their own events.
 */
export function subscribeEventListeners(server: FastifyInstance): void {
  subscribeWebhooksToEvents(server);
  server.events.on("entry.moved", "seo redirect suggestions", async (event) => {
    await suggestRedirectForMovedEntry(server.database, event.data.previousUrl, event.data.entry);
  });
}
