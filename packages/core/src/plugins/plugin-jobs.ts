import type { FastifyInstance } from "fastify";
import { type RepeatingJob, startRepeatingJob } from "../scheduler/repeating-job.js";
import type { PluginCatalogue } from "./plugin-catalogue.js";
import { createPluginContext, pluginLog, type PluginContext } from "./plugin-context.js";
import { isPluginEnabled } from "./plugins.service.js";

/**
 * Work a plugin does on a timer: once when the server starts and then every so often, but
 * only while the plugin is switched on. Every server process runs it, so a job must be safe
 * to run twice (claim work in a single update, as scheduled publishing does).
 */
export interface PluginJob<Settings = unknown> {
  /** Lowercase letters, numbers and dashes, unique within the plugin: "send-reminders". */
  id: string;
  /** For the log: "Sending booking reminders". */
  name: string;
  /** How often, in whole minutes: 1 or more. */
  everyMinutes: number;
  run(context: PluginContext<Settings>): Promise<void>;
}

const ONE_MINUTE = 60_000;

/** When a job last ran and how it went, since this server started. */
export interface PluginJobRun {
  lastRunAt: Date;
  /** The error's message when it failed; null when it worked. */
  lastError: string | null;
}

const jobRuns = new Map<string, PluginJobRun>();

/** How a plugin's job last went since the server started, for Build → Add-ons. */
export function findPluginJobRun(pluginId: string, jobId: string): PluginJobRun | undefined {
  return jobRuns.get(`${pluginId}:${jobId}`);
}

/** Starts every plugin's jobs when the server is ready, and stops them when it closes. */
export function registerPluginJobs(server: FastifyInstance, catalogue: PluginCatalogue): void {
  const running: RepeatingJob[] = [];
  server.addHook("onReady", async () => {
    for (const plugin of catalogue.plugins) {
      for (const job of plugin.jobs ?? []) {
        running.push(
          startRepeatingJob({
            everyMilliseconds: job.everyMinutes * ONE_MINUTE,
            run: async () => {
              if (!(await isPluginEnabled(server.database, plugin.id))) return;
              const key = `${plugin.id}:${job.id}`;
              try {
                await job.run(
                  createPluginContext(plugin, server.database, pluginLog(plugin.id, server.log)),
                );
                jobRuns.set(key, { lastRunAt: new Date(), lastError: null });
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                jobRuns.set(key, { lastRunAt: new Date(), lastError: message });
                throw error;
              }
            },
            onError: (error) =>
              server.log.error({ plugin: plugin.id, err: error }, `${job.name} failed`),
          }),
        );
      }
    }
  });
  server.addHook("onClose", async () => {
    await Promise.all(running.map((job) => job.stop()));
  });
}
