import type { FastifyInstance } from "fastify";
import { runScheduledBackupIfDue } from "../backups/backup-schedule.service.js";
import { backupsContextFor, markInterruptedBackups } from "../backups/backups.service.js";
import { pauseInterruptedImports } from "../wordpress-import/wordpress-import.service.js";
import { announceContentEvent } from "../content-events/content-events.js";
import { describeEntryForEvent } from "../content-events/entry-event-data.js";
import { publishDueEntries } from "../entries/entry-publishing.service.js";
import { type RepeatingJob, startRepeatingJob } from "./repeating-job.js";

const ONE_MINUTE = 60_000;
const FIVE_MINUTES = 5 * ONE_MINUTE;

/**
 * Every job the server runs on a timer, in one visible list. Each starts when the server
 * is ready (so once on startup) and stops when it closes.
 */
export function registerScheduledJobs(server: FastifyInstance): void {
  const jobs: RepeatingJob[] = [];

  server.addHook("onReady", async () => {
    // Work cut off by the last stop: backups are marked failed, imports paused to resume.
    // A database that can't be reached yet mustn't stop the server starting: /health has
    // to be able to say so.
    try {
      await markInterruptedBackups(server.database);
      await pauseInterruptedImports(server.database);
    } catch (error) {
      server.log.error(error, "Tidying up interrupted backups and imports failed");
    }
    jobs.push(
      startRepeatingJob({
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
      }),
      // Retries, and anything queued while no server was sending (see src/webhooks).
      startRepeatingJob({
        everyMilliseconds: ONE_MINUTE,
        run: async () => {
          await server.webhooks.deliverDue();
        },
        onError: (error) => server.log.error(error, "Sending webhooks failed"),
      }),
      // Daily or weekly backups, when switched on in Settings → Backups (see src/backups).
      startRepeatingJob({
        everyMilliseconds: FIVE_MINUTES,
        run: async () => {
          if (await runScheduledBackupIfDue(backupsContextFor(server))) {
            server.log.info("Made the scheduled backup");
          }
        },
        onError: (error) => server.log.error(error, "Making the scheduled backup failed"),
      }),
    );
  });

  server.addHook("onClose", async () => {
    await Promise.all(jobs.map((job) => job.stop()));
  });
}
