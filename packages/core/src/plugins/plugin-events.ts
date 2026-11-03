import type { FastifyInstance } from "fastify";
import type { PublishedEvent } from "../events/event-bus.js";
import type { LintelEventName } from "../events/event-catalogue.js";
import type { PluginCatalogue } from "./plugin-catalogue.js";
import { createPluginContext, pluginLog, type PluginContext } from "./plugin-context.js";
import { isPluginEnabled } from "./plugins.service.js";

/** One handler: told about each event of its name, with the plugin's context. */
export type PluginEventHandler<Name extends LintelEventName, Settings> = (
  event: PublishedEvent<Name>,
  context: PluginContext<Settings>,
) => Promise<void> | void;

/**
 * A plugin's handlers, keyed by event name, each typed by its event:
 *
 *   events: {
 *     "entry.published": async (event, { log }) => log.info(`${event.data.entry.title} is live`),
 *     "order.paid": async (event) => { ... },
 *   }
 */
export type PluginEventHandlers<Settings = unknown> = {
  [Name in LintelEventName]?: PluginEventHandler<Name, Settings>;
};

/**
 * Subscribes every plugin's handlers to the event bus. Each one first checks that its
 * plugin is switched on; the bus logs a handler that fails and still tells the rest.
 */
export function subscribePluginEventHandlers(
  server: FastifyInstance,
  catalogue: PluginCatalogue,
): void {
  for (const plugin of catalogue.plugins) {
    const handlers: PluginEventHandlers = plugin.events ?? {};
    for (const eventName of Object.keys(handlers) as LintelEventName[]) {
      const handler = handlers[eventName] as PluginEventHandler<LintelEventName, unknown>;
      server.events.on(eventName, `the ${plugin.name} plugin`, async (event) => {
        if (!(await isPluginEnabled(server.database, plugin.id))) return;
        await handler(
          event,
          createPluginContext(plugin, server.database, pluginLog(plugin.id, server.log)),
        );
      });
    }
  }
}
