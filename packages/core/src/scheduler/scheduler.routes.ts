import type { FastifyInstance } from "fastify";
import { checkCronSecret, findCronSecret, runScheduledJobsNow } from "./scheduler.service.js";

export const CRON_SECRET_HEADER = "x-lintel-cron-secret";

/** Plenty for a cron job every minute, too few for anyone guessing the secret. */
const RUNS_PER_MINUTE = 10;

export interface SchedulerRoutesOptions {
  /** CRON_SECRET, when it is set. Otherwise the data folder's own secret is used. */
  cronSecret?: string | undefined;
}

/**
 * HTTP only:
 *
 *   POST /system/run-scheduled-jobs   header X-Lintel-Cron-Secret -> { ran, startedAt, finishedAt }
 *
 * For hosts that pause the app when nobody visits (cPanel's "Setup Node.js App", Passenger),
 * where the timers can't be relied on: the host's cron calls this every few minutes. The
 * request also wakes the app, which then runs its jobs on start; a job already running is
 * waited for, not started twice. Elsewhere the timers do the work and this is harmless.
 */
export async function schedulerRoutes(server: FastifyInstance, options: SchedulerRoutesOptions) {
  server.post(
    "/system/run-scheduled-jobs",
    { config: { rateLimit: { max: RUNS_PER_MINUTE, timeWindow: "1 minute" } } },
    async (request) => {
      const given = request.headers[CRON_SECRET_HEADER];
      checkCronSecret(
        typeof given === "string" ? given : undefined,
        findCronSecret(options.cronSecret, server.lintelFolder),
      );
      const run = await runScheduledJobsNow(server.scheduledJobs);
      request.log.info({ ran: run.ran }, "Ran the scheduled jobs for a cron request");
      return run;
    },
  );
}
