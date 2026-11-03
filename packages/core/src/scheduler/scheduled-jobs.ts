import type { FastifyInstance } from "fastify";
import { runScheduledBackupIfDue } from "../backups/backup-schedule.service.js";
import { backupsContextFor, markInterruptedBackups } from "../backups/backups.service.js";
import { pauseInterruptedImports } from "../wordpress-import/wordpress-import.service.js";
import { pauseInterruptedSiteImports } from "../importers/site-import.service.js";
import { announceContentEvent } from "../content-events/content-events.js";
import { describeEntryForEvent } from "../content-events/entry-event-data.js";
import { publishDueEntries } from "../entries/entry-publishing.service.js";
import { checkForUpdatesIfDue } from "../updates/update-checks.service.js";
import { updateChecksContextFor } from "../updates/updates.service.js";
import { runRetentionRules } from "../privacy/retention.service.js";
import { type RepeatingJob, startRepeatingJob } from "./repeating-job.js";

const ONE_MINUTE = 60_000;
const FIVE_MINUTES = 5 * ONE_MINUTE;
const ONE_HOUR = 60 * ONE_MINUTE;

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
      await pauseInterruptedSiteImports(server.database);
    } catch (error) {
      server.log.error(error, "Tidying up interrupted backups and imports failed");
    }
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
    // Daily or weekly backups, when switched on in Settings → Backups (see src/backups).
    const backups = startRepeatingJob({
      everyMilliseconds: FIVE_MINUTES,
      run: async () => {
        if (await runScheduledBackupIfDue(backupsContextFor(server))) {
          server.log.info("Made the scheduled backup");
        }
      },
      onError: (error) => server.log.error(error, "Making the scheduled backup failed"),
    });
    // Retention rules from Settings → Privacy: old personal data deleted or anonymised.
    const retention = startRepeatingJob({
      everyMilliseconds: ONE_HOUR,
      run: async () => {
        const done = await runRetentionRules({
          database: server.database,
          forms: server.forms.context,
        });
        if (Object.values(done).some((count) => count > 0)) {
          server.log.info(done, "Applied the privacy retention rules");
        }
      },
      onError: (error) => server.log.error(error, "Applying the retention rules failed"),
    });
    jobs.push(publishing, webhooks, backups, retention);
    server.scheduledJobs.add("scheduled-publishing", publishing);
    server.scheduledJobs.add("webhook-deliveries", webhooks);
    server.scheduledJobs.add("scheduled-backups", backups);
    server.scheduledJobs.add("privacy-retention", retention);
    // Once a day, unless UPDATE_CHECKS=off (see src/updates). Checked hourly so a restart
    // doesn't push the next check back a day, and doesn't add one either.
    if (server.updates.checksEnabled) {
      const updateChecks = startRepeatingJob({
        everyMilliseconds: ONE_HOUR,
        run: async () => {
          await checkForUpdatesIfDue(updateChecksContextFor(server));
        },
        onError: (error) => server.log.error(error, "Looking for Lintel updates failed"),
      });
      jobs.push(updateChecks);
      server.scheduledJobs.add("update-checks", updateChecks);
    }
  });

  server.addHook("onClose", async () => {
    await Promise.all(jobs.map((job) => job.stop()));
  });
}
