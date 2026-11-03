import type { LoadedAddon } from "../addons/load-addons.js";
import type { Database } from "../database/client.js";
import type { FormsContext } from "../forms/forms-context.js";
import type { LintelPlugin } from "../plugins/plugin-definition.js";
import { pluginRegistry } from "../plugins/plugins.registry.js";
import {
  hasPersonalDataHooks,
  type PersonalDataHooks,
  personalDataDeclarationSchema,
  type PersonalDataDeclaration,
} from "./personal-data-declaration.js";
import { coreSources } from "./core-sources.js";

/**
 * Every kind of personal data a site can hold, as one list: Lintel's own (core-sources.ts)
 * and each plugin's or add-on's, from what it declares. Find a person, export and erase all
 * go through this list, so a new kind is searched the moment it is added here.
 */

/** What finding and erasing need from the server. */
export interface PrivacyContext {
  database: Database;
  enabledPlugins: readonly string[];
  plugins: readonly LintelPlugin[];
  addons: readonly LoadedAddon[];
  /** Deleting form entries also deletes the files sent with them (see src/forms). */
  forms: () => FormsContext;
}

export interface PersonalDataSource {
  id: string;
  name: string;
  description: string;
  /** "core", or the plugin's id. */
  from: string;
  /** The plugin it belongs to, when it is only in use while that plugin is on. */
  pluginId: string | null;
  tables: Array<{ name: string; columns: string[] }>;
  /** What erasing does, in a plain sentence; null when it can't be searched. */
  erasure: string | null;
  /** Null when it can't be searched: kept elsewhere, holds nothing identifying, or no hooks. */
  hooks: PersonalDataHooks | null;
  notSearchableReason: string | null;
}

const builtInIds: ReadonlySet<string> = new Set(pluginRegistry.map((plugin) => plugin.id));

export function listPersonalDataSources(context: PrivacyContext): PersonalDataSource[] {
  return [
    ...coreSources(context),
    ...context.plugins
      .filter((plugin) => !builtInIds.has(plugin.id))
      .flatMap((plugin) => pluginSource(plugin, findManifestDeclaration(context, plugin.id))),
  ];
}

/** Whether the source's feature is on: core's always are; a plugin's while it is switched on. */
export function isSourceInUse(source: PersonalDataSource, enabledPlugins: readonly string[]) {
  return source.pluginId === null || enabledPlugins.includes(source.pluginId);
}

function findManifestDeclaration(
  context: PrivacyContext,
  pluginId: string,
): PersonalDataDeclaration | undefined {
  return context.addons.find((addon) => addon.plugin.id === pluginId)?.addonPackage.manifest
    .personalData;
}

/**
 * A plugin's or add-on's personal data. Its own declaration wins over its package.json's.
 * Plugins without tables and without a declaration keep nothing, so they aren't listed; one
 * with tables but no declaration is listed, because it may keep personal data nobody can find.
 */
function pluginSource(
  plugin: LintelPlugin,
  fromManifest: PersonalDataDeclaration | undefined,
): PersonalDataSource[] {
  // A mistake in one plugin's declaration mustn't stop every privacy request: it is treated
  // as having said nothing, so it shows up as something to look through by hand.
  const parsed = personalDataDeclarationSchema.safeParse(plugin.personalData);
  const declared = parsed.success ? parsed.data : fromManifest;
  const tableNames = plugin.database?.tables.length ?? 0;
  if (!declared && tableNames === 0) return [];
  const personalTables = (declared?.tables ?? [])
    .map((table) => ({
      name: table.name,
      columns: table.columns.filter((column) => column.personalData).map((column) => column.name),
    }))
    .filter((table) => table.columns.length > 0);
  if (declared && personalTables.length === 0 && !hasPersonalDataHooks(plugin.personalData)) {
    return [];
  }
  const hooks = hasPersonalDataHooks(plugin.personalData) ? plugin.personalData : null;
  return [
    {
      id: `plugin:${plugin.id}`,
      name: plugin.name,
      description: declared?.description ?? plugin.description,
      from: plugin.id,
      pluginId: plugin.id,
      tables: personalTables,
      erasure: hooks ? "As the add-on decides; it says what it did." : null,
      hooks,
      notSearchableReason: hooks
        ? null
        : declared
          ? "This add-on says it keeps personal data but can't search it yet. Look in it by hand."
          : "This add-on keeps its own data and hasn't said whether any of it is personal. Look in it by hand.",
    },
  ];
}
