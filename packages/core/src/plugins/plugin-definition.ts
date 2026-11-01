import type { FastifyInstance } from "fastify";
import type { PgTable } from "drizzle-orm/pg-core";
import type { z } from "zod";
import type { DatabaseOrTransaction } from "../database/client.js";
import type { Fieldtype } from "../fieldtypes/fieldtype.js";

/**
 * What a plugin is, on the server. Every plugin, built in or installed from a package, is
 * one `definePlugin({...})` object. The admin half of a plugin (screens, sidebar items,
 * widgets) is a separate `defineAdminPlugin` in `@lintel/admin/plugin`, with the same id.
 *
 * Plugins are trusted code: they run inside the server with full access to the database.
 * See docs/decisions/0012-plugins.md for why, and what that means for installing one.
 */

/** A permission the plugin adds, such as "bookings:read", with what it lets people do. */
export interface PluginPermission {
  permission: `${string}:${string}`;
  /**
   * A short name for the role editor, such as "Refund orders". Without one, the role editor
   * uses `description` as the name.
   */
  name?: string;
  /** One plain sentence, for the roles screen: "See bookings". */
  description: string;
}

/** Settings the plugin keeps, checked by a Zod schema whenever they are read or saved. */
export interface PluginSettings<Schema extends z.ZodType = z.ZodType> {
  schema: Schema;
  /** Used until an admin saves something. Must pass `schema`. */
  defaults: z.output<Schema>;
}

/** The plugin's own tables, and where its migrations live. */
export interface PluginDatabase {
  /**
   * The Drizzle tables, for reference and for checks: each table's name must be the plugin
   * id or start with it and an underscore ("bookings", "bookings_resources").
   */
  tables: readonly PgTable[];
  /**
   * The folder drizzle-kit writes the plugin's migrations to. They are applied when the
   * server starts, recorded apart from Lintel's own, so the two never get in each other's way.
   */
  migrationsFolder: string;
}

/** What a plugin's routes are given, besides the Fastify instance to add them to. */
export interface PluginRouteContext<Settings> {
  /** The plugin's saved settings, or its defaults. */
  readSettings: (database: DatabaseOrTransaction) => Promise<Settings>;
}

export interface PluginDefinition<
  Id extends string = string,
  SettingsSchema extends z.ZodType = z.ZodType,
> {
  /** Lowercase letters, numbers and dashes, starting with a letter: "bookings". */
  id: Id;
  /** Shown in Settings → Features and on the setup screen: "Bookings". */
  name: string;
  /** One plain sentence about what it adds: "Appointments and the people who made them." */
  description: string;
  /** The package version, shown in Settings → Features. */
  version?: string;
  permissions?: readonly PluginPermission[];
  settings?: PluginSettings<SettingsSchema>;
  database?: PluginDatabase;
  /**
   * Adds the plugin's API routes. They are registered in a scope of their own that answers
   * 404 PLUGIN_NOT_ENABLED while the plugin is switched off, so routes never check that
   * themselves. Check permissions with `requirePermission` as core routes do.
   */
  routes?(
    server: FastifyInstance,
    context: PluginRouteContext<z.output<SettingsSchema>>,
  ): Promise<void> | void;
  /**
   * Kinds of field editors can add to content types. Each `type` must start with the
   * plugin id and a dot ("bookings.duration"). The admin needs a matching field editor.
   */
  fieldtypes?: readonly Fieldtype[];
  /**
   * Makes the content the plugin needs (a collection, say) each time it is switched on.
   * It must only create what is missing: it runs again after every switch off and on.
   */
  createContent?(database: DatabaseOrTransaction): Promise<void>;
}

/** A plugin with its settings type erased, so different plugins can share one list. */
export type LintelPlugin = PluginDefinition<string, z.ZodType>;

/**
 * Defines a plugin. It only returns what it is given, typed: the point is that TypeScript
 * checks the definition (and infers the settings type for `readSettings`) as it is written.
 */
export function definePlugin<const Id extends string, SettingsSchema extends z.ZodType = z.ZodType>(
  definition: PluginDefinition<Id, SettingsSchema>,
): PluginDefinition<Id, SettingsSchema> {
  return definition;
}

/** `lintel.config.ts` at the repository root: the plugin packages this site installs. */
export interface LintelConfig {
  /**
   * Package names, in the order their contributions appear. Each package must be a
   * dependency of the repository root, and export `./server` (a `definePlugin`) and
   * `./admin` (a `defineAdminPlugin`).
   */
  plugins: readonly string[];
}
