import { z } from "zod";

/**
 * A list of plugin ids. Whether each one is installed is checked by the service, against
 * the server's plugin catalogue (see plugins.service.ts), because that list is only known
 * once the server has been built with its installed plugins.
 */
export const pluginIdListSchema = z.array(z.string({ error: "Plugin ids should be text" }), {
  error: "Please send a list of plugin ids",
});

/**
 * The same list, where each id must be one of `installedIds`. Routes use it so a mistake
 * is reported with any other problems in the request, in one message.
 */
export function installedPluginIdListSchema(installedIds: readonly string[]) {
  return z.array(
    z.string({ error: "Plugin ids should be text" }).refine((id) => installedIds.includes(id), {
      error: (issue) =>
        `There is no plugin called "${String(issue.input)}". The plugins are: ${installedIds.join(", ")}`,
    }),
    { error: "Please send a list of plugin ids" },
  );
}

/** `PUT /plugins` */
export function updatePluginsRequestSchema(installedIds: readonly string[]) {
  return z.object({ enabled: installedPluginIdListSchema(installedIds) });
}

export const pluginIdParamsSchema = z.object({ id: z.string() });

/** One plugin as `GET /plugins` shows it. */
export const pluginSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  enabled: z.boolean(),
  /** "built-in" ships with Lintel; "installed" was added in lintel.config.ts. */
  source: z.enum(["built-in", "installed"]),
  version: z.string().nullable(),
  permissions: z.array(z.object({ permission: z.string(), description: z.string() })),
  hasSettings: z.boolean(),
});

export const pluginListSchema = z.object({ plugins: z.array(pluginSummarySchema) });

export type PluginSummary = z.infer<typeof pluginSummarySchema>;
export type PluginList = z.infer<typeof pluginListSchema>;
