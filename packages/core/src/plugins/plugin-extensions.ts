import type { FastifyInstance } from "fastify";
import type { PluginCatalogue } from "./plugin-catalogue.js";
import { subscribePluginEventHandlers } from "./plugin-events.js";
import { registerPluginJobs } from "./plugin-jobs.js";

/**
 * Connects what plugins add beyond routes: event handlers to the event bus and jobs to the
 * server's timer (unless the server runs no timed jobs, as in tests). Each checks that its
 * plugin is on when it runs. Liquid tags are added earlier, before the templates' engine is
 * made (see `registerPluginLiquid` in buildServer).
 */
export function connectPluginExtensions(
  server: FastifyInstance,
  catalogue: PluginCatalogue,
  options: { runScheduledJobs: boolean },
): void {
  subscribePluginEventHandlers(server, catalogue);
  if (options.runScheduledJobs) registerPluginJobs(server, catalogue);
}
