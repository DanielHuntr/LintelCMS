import type { FastifyInstance } from "fastify";
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
    jobs.push(
      startRepeatingJob({
        everyMilliseconds: ONE_MINUTE,
        run: async () => {
          const published = await publishDueEntries(server.database);
          if (published.length > 0) {
            server.log.info({ entryIds: published }, "Published scheduled entries");
          }
        },
        onError: (error) => server.log.error(error, "Publishing scheduled entries failed"),
      }),
    );
  });

  server.addHook("onClose", async () => {
    await Promise.all(jobs.map((job) => job.stop()));
  });
}
