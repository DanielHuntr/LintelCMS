import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import type { DatabaseOrTransaction } from "../database/client.js";
import type { PluginCatalogue } from "../plugins/plugin-catalogue.js";
import type { LintelPlugin } from "../plugins/plugin-definition.js";
import { findEnabledPluginIds, setEnabledPlugins } from "../plugins/plugins.service.js";
import { readAddonsList, writeAddonsList } from "./addons-list.js";
import { AddonFileNotFoundError } from "./addons.errors.js";
import type { AddonAdminScripts, AddonList, AddonPart, AddonSummary } from "./addons.schema.js";
import type { AddonsState, LoadedAddon } from "./load-addons.js";

/**
 * Every add-on for the Add-ons screen: those that loaded (from npm, a linked folder or
 * lintel.config.ts), then those that couldn't, with why.
 */
export async function listAddons(
  database: DatabaseOrTransaction,
  catalogue: PluginCatalogue,
  addons: AddonsState,
): Promise<AddonList> {
  const enabled = new Set(await findEnabledPluginIds(database));
  const byId = new Map(addons.loaded.map((addon) => [addon.plugin.id, addon]));
  const installed: AddonSummary[] = catalogue.entries
    .filter(({ source }) => source === "installed")
    .map(({ plugin }) => summarise(plugin, byId.get(plugin.id), enabled.has(plugin.id)));
  const failed: AddonSummary[] = addons.problems.map((problem) => ({
    id: problem.id,
    name: problem.name,
    description: "",
    packageName: problem.linked ? null : problem.name,
    version: problem.version,
    from: problem.linked ? "folder" : "npm",
    enabled: false,
    adds: [],
    permissions: [],
    settingsSchema: null,
    problem: problem.message,
  }));
  return { addons: [...installed, ...failed], folder: addons.folder };
}

function summarise(
  plugin: LintelPlugin,
  addon: LoadedAddon | undefined,
  enabled: boolean,
): AddonSummary {
  return {
    id: plugin.id,
    name: plugin.name,
    description: plugin.description,
    packageName: addon?.addonPackage.packageName ?? null,
    version: addon?.addonPackage.version ?? plugin.version ?? null,
    from: addon ? (addon.linked ? "folder" : "npm") : "config",
    enabled,
    adds: partsOf(plugin, addon),
    permissions: (plugin.permissions ?? []).map(({ permission, description }) => ({
      permission,
      description,
    })),
    settingsSchema: plugin.settings ? settingsJsonSchema(plugin.settings.schema) : null,
    problem: null,
  };
}

function partsOf(plugin: LintelPlugin, addon: LoadedAddon | undefined): AddonPart[] {
  const liquidCount = (plugin.liquid?.tags?.length ?? 0) + (plugin.liquid?.filters?.length ?? 0);
  const has: Array<[AddonPart, boolean]> = [
    ["fieldtypes", (plugin.fieldtypes?.length ?? 0) > 0],
    ["blocks", (plugin.blocks?.length ?? 0) > 0],
    ["liquid", liquidCount > 0],
    ["events", Object.keys(plugin.events ?? {}).length > 0],
    ["jobs", (plugin.jobs?.length ?? 0) > 0],
    ["commands", (plugin.commands?.length ?? 0) > 0],
    ["routes", plugin.routes !== undefined],
    ["tables", plugin.database !== undefined],
    ["settings", plugin.settings !== undefined],
    // Plugins from lintel.config.ts always have one, bundled with the admin.
    ["admin", addon ? addon.addonPackage.manifest.admin !== undefined : true],
  ];
  return has.filter(([, present]) => present).map(([part]) => part);
}

/** The settings' JSON Schema, so the admin can draw a form; null if it can't be written. */
function settingsJsonSchema(schema: z.ZodType): Record<string, unknown> | null {
  try {
    const jsonSchema: unknown = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" });
    return typeof jsonSchema === "object" && jsonSchema !== null
      ? (jsonSchema as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** The admin halves the admin should load: every loaded add-on that has one. */
export async function listAdminScripts(addons: AddonsState): Promise<AddonAdminScripts> {
  const scripts: AddonAdminScripts["scripts"] = [];
  for (const { plugin, addonPackage } of addons.loaded) {
    const { admin, adminStyles } = addonPackage.manifest;
    if (!admin) continue;
    const file = join(addonPackage.folder, admin);
    if (!existsSync(file)) continue;
    // The file's time in the address, so a new version is never taken from a cache.
    const changed = Math.round((await stat(file)).mtimeMs);
    scripts.push({
      id: plugin.id,
      script: `/addons/${plugin.id}/admin.js?v=${changed}`,
      styles: adminStyles ? `/addons/${plugin.id}/admin.css?v=${changed}` : null,
    });
  }
  return { scripts };
}

/** An add-on's built admin script or stylesheet. */
export async function readAdminFile(
  addons: AddonsState,
  addonId: string,
  kind: "script" | "styles",
): Promise<string> {
  const addon = addons.loaded.find(({ plugin }) => plugin.id === addonId);
  const manifest = addon?.addonPackage.manifest;
  const relative = kind === "script" ? manifest?.admin : manifest?.adminStyles;
  if (!addon || !relative) throw new AddonFileNotFoundError(addonId);
  const file = join(addon.addonPackage.folder, relative);
  if (!existsSync(file)) throw new AddonFileNotFoundError(addonId);
  return readFile(file, "utf8");
}

/**
 * Switches on the add-ons `lintel addons add` asked for, once they have loaded, and takes
 * them off the list. Ones that didn't load stay on it, to be switched on when they do.
 */
export async function enableAddonsAskedFor(
  database: DatabaseOrTransaction,
  catalogue: PluginCatalogue,
  addons: AddonsState,
): Promise<string[]> {
  if (!addons.folder || addons.enableOnStart.length === 0) return [];
  const ready = addons.enableOnStart.filter((id) => catalogue.has(id));
  if (ready.length > 0) {
    const current = await findEnabledPluginIds(database);
    await setEnabledPlugins(database, catalogue, [
      ...current.filter((id) => catalogue.has(id)),
      ...ready,
    ]);
  }
  const list = await readAddonsList(addons.folder);
  await writeAddonsList(addons.folder, {
    ...list,
    enableOnStart: list.enableOnStart.filter((id) => !ready.includes(id)),
  });
  return ready;
}
