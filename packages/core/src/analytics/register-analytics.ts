import type { FastifyInstance } from "fastify";
import { readPluginSettings } from "../plugins/plugin-settings.service.js";
import { isPluginEnabled } from "../plugins/plugins.service.js";
import { startRepeatingJob, type RepeatingJob } from "../scheduler/repeating-job.js";
import { analyticsPlugin } from "./analytics.plugin.js";
import { analyticsSettingsSchema, defaultAnalyticsSettings } from "./analytics-settings.schema.js";
import { recordFormGoal, recordOrderGoal } from "./goals.service.js";
import { applyRetention, rollUpEveryKeptDay, rollUpRecentDays } from "./rollups.service.js";

const FIVE_MINUTES = 5 * 60_000;
const ONE_HOUR = 60 * 60_000;

/**
 * What the Visitors plugin needs besides its routes (registered in server.ts beside forms
 * and the shop):
 *
 *   - goals from the event bus: "form.submitted" and "order.paid", while the plugin is on;
 *   - the timed jobs: daily figures every five minutes (every kept day once at start), and
 *     the retention each hour. Retention runs even while the plugin is off, so switching it
 *     off never keeps visits longer than promised.
 */
export function registerAnalytics(
  server: FastifyInstance,
  options: { runScheduledJobs: boolean },
): void {
  const isOn = () => isPluginEnabled(server.database, analyticsPlugin.id);

  server.events.on("form.submitted", "visitor goals", async (event) => {
    if (!(await isOn())) return;
    await recordFormGoal(server.database, event.data.form, event.data.submission.id);
  });
  server.events.on("order.paid", "visitor goals", async (event) => {
    if (!(await isOn())) return;
    await recordOrderGoal(server.database, event.data.order);
  });

  if (!options.runScheduledJobs) return;
  const jobs: RepeatingJob[] = [];
  server.addHook("onReady", async () => {
    let caughtUp = false;
    const rollUp = startRepeatingJob({
      everyMilliseconds: FIVE_MINUTES,
      run: async () => {
        if (!caughtUp) {
          await rollUpEveryKeptDay(server.database);
          caughtUp = true;
        }
        await rollUpRecentDays(server.database, new Date());
      },
      onError: (error) => server.log.error(error, "Counting the day's visitors failed"),
    });
    const retention = startRepeatingJob({
      everyMilliseconds: ONE_HOUR,
      run: async () => {
        const settings = await readAnalyticsSettings(server);
        await applyRetention(server.database, settings.retentionDays, new Date());
      },
      onError: (error) => server.log.error(error, "Deleting old visits failed"),
    });
    jobs.push(rollUp, retention);
    server.scheduledJobs.add("visitor-counts", rollUp);
    server.scheduledJobs.add("visit-retention", retention);
  });
  server.addHook("onClose", async () => {
    await Promise.all(jobs.map((job) => job.stop()));
  });
}

export async function readAnalyticsSettings(server: FastifyInstance) {
  const parsed = analyticsSettingsSchema.safeParse(
    await readPluginSettings(server.database, analyticsPlugin),
  );
  return parsed.success ? parsed.data : defaultAnalyticsSettings;
}
