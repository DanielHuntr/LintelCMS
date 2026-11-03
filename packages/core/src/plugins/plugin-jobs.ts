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
              await job.run(
                createPluginContext(plugin, server.database, pluginLog(plugin.id, server.log)),
              );
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
