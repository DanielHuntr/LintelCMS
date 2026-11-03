import type { FastifyBaseLogger } from "fastify";
import type { DatabaseOrTransaction } from "../database/client.js";
import type { LintelPlugin } from "./plugin-definition.js";
import { readPluginSettings } from "./plugin-settings.service.js";

/** Where a plugin writes what it did, into Lintel's own log, marked with the plugin's id. */
export interface PluginLog {
  info(message: string, details?: Record<string, unknown>): void;
  error(message: string, error?: unknown): void;
}

/**
 * What a plugin's event handlers, jobs, Liquid tags and commands are given: the database,
 * the plugin's saved settings (or its defaults) and a log.
 */
export interface PluginContext<Settings = unknown> {
  database: DatabaseOrTransaction;
  readSettings(): Promise<Settings>;
  log: PluginLog;
}

/** A context for one plugin. Pass `pluginLog(plugin.id, server.log)` for the server's log. */
export function createPluginContext<Settings>(
  plugin: LintelPlugin,
  database: DatabaseOrTransaction,
  log: PluginLog,
): PluginContext<Settings> {
  return {
    database,
    // The plugin's own schema checked the value, so it has the plugin's settings type.
    readSettings: async () =>
      (plugin.settings ? await readPluginSettings(database, plugin) : {}) as Settings,
    log,
  };
}

/** The server's log, with the plugin's id on every line. */
export function pluginLog(pluginId: string, logger: FastifyBaseLogger): PluginLog {
  return {
    info: (message, details) => logger.info({ plugin: pluginId, ...details }, message),
    error: (message, error) => logger.error({ plugin: pluginId, err: error }, message),
  };
}
