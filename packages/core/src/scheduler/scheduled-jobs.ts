import type { FastifyInstance } from "fastify";
import { announceContentEvent } from "../content-events/content-events.js";
import { describeEntryForEvent } from "../content-events/entry-event-data.js";
import { publishDueEntries } from "../entries/entry-publishing.service.js";
import { type RepeatingJob, startRepeatingJob } from "./repeating-job.js";

const ONE_MINUTE = 60_000;

/**
 * Every job the server runs on a timer, in one visible list. Each starts when the server
 * is ready (so once on startup) and stops when it closes.
 */
export function registerScheduledJobs(server: FastifyInstance): void {
  const jobs: RepeatingJob[] = [];

  server.addHook("onReady", async () => {
    const publishing = startRepeatingJob({
      everyMilliseconds: ONE_MINUTE,
      run: async () => {
        const published = await publishDueEntries(server.database);
        if (published.length > 0) {
          server.log.info({ entryIds: published }, "Published scheduled entries");
        }
        for (const entryId of published) {
          const entry = await describeEntryForEvent(server.database, entryId);
          await announceContentEvent(server, { name: "entry.published", entry });
        }
      },
      onError: (error) => server.log.error(error, "Publishing scheduled entries failed"),
    });
    // Retries, and anything queued while no server was sending (see src/webhooks).
    const webhooks = startRepeatingJob({
      everyMilliseconds: ONE_MINUTE,
      run: async () => {
        await server.webhooks.deliverDue();
      },
      onError: (error) => server.log.error(error, "Sending webhooks failed"),
    });
    jobs.push(publishing, webhooks);
    server.scheduledJobs.add("scheduled-publishing", publishing);
    server.scheduledJobs.add("webhook-deliveries", webhooks);
  });

  server.addHook("onClose", async () => {
    await Promise.all(jobs.map((job) => job.stop()));
  });
}
