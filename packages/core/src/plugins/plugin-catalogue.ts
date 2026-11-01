import { getTableName } from "drizzle-orm";
import { registerPluginFieldtypes } from "../fieldtypes/fieldtypes.registry.js";
import type { LintelPlugin } from "./plugin-definition.js";
import { InvalidPluginError } from "./plugins.errors.js";

/** "built-in" plugins ship with Lintel; "installed" ones come from lintel.config.ts. */
export type PluginSource = "built-in" | "installed";

export interface CataloguedPlugin {
  plugin: LintelPlugin;
  source: PluginSource;
}

/** A plugin's migrations, applied apart from Lintel's own (see src/database). */
export interface PluginMigrations {
  pluginId: string;
  migrationsFolder: string;
}

const PLUGIN_ID_PATTERN = /^[a-z][a-z0-9-]*$/;

/**
 * Every plugin this server knows about: the built-in ones first, in the order of their
 * list, then the installed ones in the order of lintel.config.ts. Built once in
 * `buildServer` and kept on `server.plugins`.
 *
 * Each plugin is checked here, so a mistake in a plugin stops the server at start with a
 * message saying what to fix, rather than surfacing later as a confusing request error.
 */
export class PluginCatalogue {
  readonly entries: readonly CataloguedPlugin[];

  constructor(builtIn: readonly LintelPlugin[], installed: readonly LintelPlugin[] = []) {
    this.entries = [
      ...builtIn.map((plugin) => ({ plugin, source: "built-in" as const })),
      ...installed.map((plugin) => ({ plugin, source: "installed" as const })),
    ];
    const seen = new Set<string>();
    for (const { plugin } of this.entries) {
      if (seen.has(plugin.id)) {
        throw new InvalidPluginError(plugin.id, "another plugin already has this id.");
      }
      seen.add(plugin.id);
      checkPlugin(plugin);
      registerPluginFieldtypes(plugin.id, plugin.fieldtypes ?? []);
    }
  }

  get plugins(): LintelPlugin[] {
    return this.entries.map((entry) => entry.plugin);
  }

  get ids(): string[] {
    return this.entries.map((entry) => entry.plugin.id);
  }

  find(pluginId: string): LintelPlugin | undefined {
    return this.entries.find((entry) => entry.plugin.id === pluginId)?.plugin;
  }

  has(pluginId: string): boolean {
    return this.find(pluginId) !== undefined;
  }

  get migrations(): PluginMigrations[] {
    return this.plugins.flatMap((plugin) =>
      plugin.database
        ? [{ pluginId: plugin.id, migrationsFolder: plugin.database.migrationsFolder }]
        : [],
    );
  }
}

function checkPlugin(plugin: LintelPlugin): void {
  const problem = findProblem(plugin);
  if (problem) {
    throw new InvalidPluginError(plugin.id, problem);
  }
}

function findProblem(plugin: LintelPlugin): string | undefined {
  if (!PLUGIN_ID_PATTERN.test(plugin.id)) {
    return "ids use lowercase letters, numbers and dashes, and start with a letter.";
  }
  if (!plugin.name.trim() || !plugin.description.trim()) {
    return "it needs a name and a description.";
  }
  const strayPermission = plugin.permissions?.find(
    ({ permission }) => !permission.startsWith(`${plugin.id}:`),
  );
  if (strayPermission) {
    return `its permission "${strayPermission.permission}" should start with "${plugin.id}:".`;
  }
  const strayTable = plugin.database?.tables
    .map((table) => getTableName(table))
    .find(
      (name) => name !== plugin.id.replaceAll("-", "_") && !name.startsWith(tablePrefix(plugin)),
    );
  if (strayTable) {
    return `its table "${strayTable}" should be called "${tablePrefix(plugin)}…".`;
  }
  const strayFieldtype = plugin.fieldtypes?.find(({ type }) => !type.startsWith(`${plugin.id}.`));
  if (strayFieldtype) {
    return `its fieldtype "${strayFieldtype.type}" should start with "${plugin.id}.".`;
  }
  if (plugin.settings && !plugin.settings.schema.safeParse(plugin.settings.defaults).success) {
    return "its default settings don't pass its own settings schema.";
  }
  return undefined;
}

/** Table names use underscores, so "gift-cards" owns "gift_cards_…". */
function tablePrefix(plugin: LintelPlugin): string {
  return `${plugin.id.replaceAll("-", "_")}_`;
}
