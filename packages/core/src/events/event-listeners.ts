import type { FastifyInstance } from "fastify";
import { suggestRedirectForMovedEntry } from "../seo/redirect-suggestions.service.js";
import { subscribeWebhooksToEvents } from "../webhooks/webhook-event-listener.js";

/**
 * Who listens to which events, in one visible list:
 *
 *   - webhooks: every event a webhook can ask for (src/webhooks);
 *   - SEO: "entry.moved" suggests a redirect from the old address (src/seo);
 *   - the built-in website: every entry and asset event empties its rendered pages, so a
 *     change made without a request (scheduled publishing, say) shows straight away
 *     (src/website);
 *   - automations: every event, to start the workflows it triggers. They subscribe in
 *     `registerWorkflows` (src/workflows), which also declares their own events.
 */
export function subscribeEventListeners(server: FastifyInstance): void {
  subscribeWebhooksToEvents(server);
  server.events.onEvery("website rendered pages", async (event) => {
    if (event.name.startsWith("entry.") || event.name.startsWith("asset.")) {
      server.website.renderedPages.clear();
    }
  });
  server.events.on("entry.moved", "seo redirect suggestions", async (event) => {
    await suggestRedirectForMovedEntry(server.database, event.data.previousUrl, event.data.entry);
  });
}
