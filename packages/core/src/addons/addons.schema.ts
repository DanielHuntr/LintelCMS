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

const tableSizeSchema = z.object({
  /** Null when the table isn't in the database. */
  rows: z.number().int().nullable(),
  /** Bytes on disk, indexes included; null when it can't be measured. */
  bytes: z.number().int().nullable(),
});

/**
 * `GET /addons/:id/details`: everything Build → Add-ons says about one add-on. Each part
 * says where it comes from: `checked` items Lintel found for itself (the tables in the
 * database, the routes, jobs, events and permissions the code registered); the rest is what
 * the add-on says about itself (purposes, personal data, hosts).
 */
export const addonDetailsSchema = z.object({
  id: z.string(),
  stores: z.object({
    tables: z.array(
      tableSizeSchema.extend({
        name: z.string(),
        purpose: z.string(),
        columns: z.array(
          z.object({
            name: z.string(),
            purpose: z.string(),
            personalData: z.boolean(),
            /** Lintel found the column in the table. */
            checked: z.boolean(),
          }),
        ),
        /** Lintel found the table in the database. */
        checked: z.boolean(),
      }),
    ),
    /** Tables with the add-on's name that it doesn't describe: Lintel warns about them. */
    undeclared: z.array(tableSizeSchema.extend({ name: z.string() })),
    /** It keeps settings (in Lintel's settings). */
    settings: z.boolean(),
  }),
  website: z.object({
    publicRoutes: z.array(
      z.object({
        method: z.string(),
        path: z.string(),
        purpose: z.string(),
        /** Lintel found the add-on registering it. */
        checked: z.boolean(),
      }),
    ),
    /** Other API routes it registered that it doesn't describe as public. */
    otherRoutes: z.number().int(),
    adminScreens: z.boolean(),
    blocks: z.array(z.string()),
  }),
  runs: z.object({
    jobs: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        everyMinutes: z.number().nullable(),
        purpose: z.string().nullable(),
        /** Since Lintel last started; null if it hasn't run yet. */
        lastRunAt: z.iso.datetime().nullable(),
        lastError: z.string().nullable(),
        checked: z.boolean(),
      }),
    ),
    events: z.array(
      z.object({ event: z.string(), purpose: z.string().nullable(), checked: z.boolean() }),
    ),
  }),
  talksTo: z.object({
    hosts: z.array(z.object({ host: z.string(), purpose: z.string() })),
    /** Services the cookie notice asks about while it is on: checked. */
    consentServices: z.array(z.string()),
    /** Its settings can add services to the cookie notice ("Count only after they accept"). */
    consentFromSettings: z.boolean(),
  }),
  origin: z.object({
    packageName: z.string().nullable(),
    version: z.string().nullable(),
    publisher: z.string().nullable(),
    licence: z.string().nullable(),
    source: z.string().nullable(),
    /** npm's integrity for the installed package ("sha512-…"), when npm installed it. */
    integrity: z.string().nullable(),
    /** SHA-256 of the server file Lintel runs, worked out by Lintel. */
    fingerprint: z.string().nullable(),
  }),
  permissions: z.array(z.object({ permission: z.string(), description: z.string() })),
});
export type AddonDetails = z.infer<typeof addonDetailsSchema>;

/** `POST /addons/:id/delete-data` must say so. */
export const deleteAddonDataRequestSchema = z.object({ confirm: z.literal("DELETE") });

/** `GET /addons/:id/export?format=json|csv&table=…` */
export const addonExportQuerySchema = z.object({
  format: z.enum(["json", "csv"]).default("json"),
  table: z.string().optional(),
});
