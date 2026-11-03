import { getTableName } from "drizzle-orm";
import { pluginBlockPrefix, registerPluginBlocks } from "../blocks/define-block.js";
import { registerPluginConsentServices } from "../cookie-notice/plugin-consent-services.js";
import { registerPluginFieldtypes } from "../fieldtypes/fieldtypes.registry.js";
import { registerPluginPermissions } from "../roles/permission-catalog.js";
import type { LintelPlugin } from "./plugin-definition.js";
import { findLiquidProblem } from "./plugin-liquid.js";
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
/** Consent services' handles, jobs' ids and commands' names. */
const CONSENT_HANDLE_PATTERN = /^[a-z][a-z0-9-]*$/;

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
      registerPluginBlocks(plugin.id, plugin.blocks ?? []);
      registerPluginConsentServices(plugin.id, plugin.consentServices ?? []);
      registerPluginPermissions(plugin);
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
  const problem = findPluginProblem(plugin);
  if (problem) {
    throw new InvalidPluginError(plugin.id, problem);
  }
}

/** What is wrong with a plugin, in a sentence, or undefined when nothing is. */
export function findPluginProblem(plugin: LintelPlugin): string | undefined {
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
  const strayBlock = plugin.blocks?.find(
    ({ handle }) => !handle?.startsWith(pluginBlockPrefix(plugin.id)),
  );
  if (strayBlock) {
    return `its block "${strayBlock.handle ?? strayBlock.name}" needs a handle starting with "${pluginBlockPrefix(plugin.id)}".`;
  }
  const strayService = plugin.consentServices?.find(
    ({ handle, name }) => !CONSENT_HANDLE_PATTERN.test(handle) || !name.trim(),
  );
  if (strayService) {
    return `its consent service "${strayService.handle}" needs a handle of lowercase letters, numbers and dashes, and a name.`;
  }
  const liquidProblem = findLiquidProblem(plugin);
  if (liquidProblem) return liquidProblem;
  const strayJob = plugin.jobs?.find(
    ({ id, name, everyMinutes }) =>
      !CONSENT_HANDLE_PATTERN.test(id) ||
      !name.trim() ||
      !Number.isInteger(everyMinutes) ||
      everyMinutes < 1,
  );
  if (strayJob) {
    return `its job "${strayJob.id}" needs an id of lowercase letters, numbers and dashes, a name, and everyMinutes of 1 or more.`;
  }
  const strayCommand = plugin.commands?.find(
    ({ name, description }) => !CONSENT_HANDLE_PATTERN.test(name) || !description.trim(),
  );
  if (strayCommand) {
    return `its command "${strayCommand.name}" needs a name of lowercase letters, numbers and dashes, and a description.`;
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
