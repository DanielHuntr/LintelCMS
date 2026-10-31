import { z } from "zod";
import { isPluginId, pluginRegistry } from "./plugins.registry.js";

const knownIds = pluginRegistry.map((plugin) => plugin.id).join(", ");

/** A list of plugin ids, each of which must be in the registry. */
export const pluginIdListSchema = z.array(
  z.string({ error: "Plugin ids should be text" }).refine(isPluginId, {
    error: (issue) =>
      `There is no plugin called "${String(issue.input)}". The plugins are: ${knownIds}`,
  }),
  { error: "Please send a list of plugin ids" },
);

/** `PUT /plugins` */
export const updatePluginsRequestSchema = z.object({ enabled: pluginIdListSchema });

/** One plugin as `GET /plugins` shows it. */
export const pluginSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  enabled: z.boolean(),
});

export const pluginListSchema = z.object({ plugins: z.array(pluginSummarySchema) });

export type PluginSummary = z.infer<typeof pluginSummarySchema>;
export type PluginList = z.infer<typeof pluginListSchema>;
