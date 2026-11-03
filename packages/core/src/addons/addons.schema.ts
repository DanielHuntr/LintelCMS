import { z } from "zod";

/** What an add-on adds, for the Add-ons screen to put in words. */
export const addonPartSchema = z.enum([
  "fieldtypes",
  "blocks",
  "liquid",
  "events",
  "jobs",
  "commands",
  "routes",
  "tables",
  "settings",
  "admin",
]);
export type AddonPart = z.infer<typeof addonPartSchema>;

/**
 * One add-on on the Add-ons screen. `from` says how it got there: "npm" (lintel addons add),
 * "folder" (lintel addons link) or "config" (lintel.config.ts in a copy of the source).
 * `problem` is set, and the rest mostly empty, for one that couldn't be loaded.
 */
export const addonSummarySchema = z.object({
  id: z.string().nullable(),
  name: z.string(),
  description: z.string(),
  packageName: z.string().nullable(),
  version: z.string().nullable(),
  from: z.enum(["npm", "folder", "config"]),
  enabled: z.boolean(),
  adds: z.array(addonPartSchema),
  permissions: z.array(z.object({ permission: z.string(), description: z.string() })),
  /** The settings' JSON Schema, for a form drawn from it; null without settings. */
  settingsSchema: z.record(z.string(), z.unknown()).nullable(),
  problem: z.string().nullable(),
});
export type AddonSummary = z.infer<typeof addonSummarySchema>;

/** `GET /addons` */
export const addonListSchema = z.object({
  addons: z.array(addonSummarySchema),
  /** Where add-ons are installed, for the "how to add one" note. Null in tests. */
  folder: z.string().nullable(),
});
export type AddonList = z.infer<typeof addonListSchema>;

/** `GET /addons/admin-scripts`: the admin halves to load, as paths under the API. */
export const addonAdminScriptsSchema = z.object({
  scripts: z.array(z.object({ id: z.string(), script: z.string(), styles: z.string().nullable() })),
});
export type AddonAdminScripts = z.infer<typeof addonAdminScriptsSchema>;

export const addonIdParamsSchema = z.object({ id: z.string() });
