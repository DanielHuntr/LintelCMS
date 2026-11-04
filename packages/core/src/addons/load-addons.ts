import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { findPluginProblem } from "../plugins/plugin-catalogue.js";
import type { LintelPlugin } from "../plugins/plugin-definition.js";
import { shareServerModules } from "./addon-modules.js";
import { type AddonPackage, AddonPackageError, readAddonPackage } from "./addon-package.js";
import { installedPackageFolder, readAddonsList } from "./addons-list.js";
import { isVersionInRange } from "./version-range.js";

/** An add-on that loaded: its plugin, its package, and whether it is a linked folder. */
export interface LoadedAddon {
  plugin: LintelPlugin;
  addonPackage: AddonPackage;
  linked: boolean;
}

/** An add-on that was left out, and why, in words for the Add-ons screen. */
export interface AddonProblem {
  /** The package name, or the folder for a linked one that couldn't be read. */
  name: string;
  id: string | null;
  version: string | null;
  linked: boolean;
  message: string;
}

/** Every add-on the site has, as found when the server started (`server.addons`). */
export interface AddonsState {
  folder: string | null;
  loaded: LoadedAddon[];
  problems: AddonProblem[];
  /** Ids to switch on at start, from `lintel addons add`. */
  enableOnStart: string[];
}

export const noAddons: AddonsState = { folder: null, loaded: [], problems: [], enableOnStart: [] };

export interface LoadAddonsOptions {
  lintelVersion: string;
  /** The ids of the plugins Lintel already has (built in, and from lintel.config.ts). */
  takenIds: readonly string[];
}

/**
 * Loads each add-on in the folder's list on its own. One that can't be found, doesn't work
 * with this version of Lintel, fails to load or fails Lintel's checks is left out with a
 * message, and the site starts without it: one broken add-on must not take a site down.
 */
export async function loadAddons(folder: string, options: LoadAddonsOptions): Promise<AddonsState> {
  const list = await readAddonsList(folder);
  const state: AddonsState = {
    folder,
    loaded: [],
    problems: [],
    enableOnStart: list.enableOnStart,
  };
  const sources = [
    ...list.packages.map((name) => ({
      name,
      path: installedPackageFolder(folder, name),
      linked: false,
    })),
    ...list.linked.map((path) => ({
      name: path,
      path: isAbsolute(path) ? path : resolve(folder, path),
      linked: true,
    })),
  ];
  if (sources.length > 0) shareServerModules();
  const taken = new Set(options.takenIds);
  for (const source of sources) {
    let addonPackage: AddonPackage | null = null;
    try {
      if (!existsSync(source.path)) throw missingError(source.linked);
      addonPackage = await readAddonPackage(source.path);
      const plugin = await loadOne(addonPackage, options.lintelVersion, taken);
      taken.add(plugin.id);
      state.loaded.push({ plugin, addonPackage, linked: source.linked });
    } catch (error) {
      state.problems.push({
        name: addonPackage?.packageName ?? source.name,
        id: addonPackage?.manifest.id ?? null,
        version: addonPackage?.version ?? null,
        linked: source.linked,
        message: describeProblem(error),
      });
    }
  }
  return state;
}

/** One built add-on, on its own, for `lintel addons check`. Throws if it won't load. */
export async function loadAddonInFolder(
  folder: string,
  lintelVersion: string,
): Promise<LintelPlugin> {
  shareServerModules();
  return loadOne(await readAddonPackage(folder), lintelVersion, new Set());
}

async function loadOne(
  addonPackage: AddonPackage,
  lintelVersion: string,
  taken: ReadonlySet<string>,
): Promise<LintelPlugin> {
  const { manifest, packageName } = addonPackage;
  if (!isVersionInRange(lintelVersion, manifest.lintel)) {
    throw new AddonPackageError(
      `It works with Lintel ${manifest.lintel}, and this is Lintel ${lintelVersion}. Look for a newer version of it.`,
    );
  }
  if (taken.has(manifest.id)) {
    throw new AddonPackageError(`Another plugin already uses the id "${manifest.id}".`);
  }
  if (addonPackage.dataOnly) return dataOnlyPlugin(addonPackage);
  const serverFile = join(addonPackage.folder, manifest.server);
  if (!existsSync(serverFile)) {
    throw new AddonPackageError(
      `Its server file (${manifest.server}) is missing. If you're building it, run lintel addons build.`,
    );
  }
  // The file's time in the address, so a rebuilt linked add-on is read afresh.
  const changed = (await stat(serverFile)).mtimeMs;
  const loaded: unknown = await import(`${pathToFileURL(serverFile).href}?v=${changed}`);
  const plugin = (loaded as { default?: unknown }).default;
  if (!isPlugin(plugin)) {
    throw new AddonPackageError(
      `${manifest.server} should export default definePlugin({...}) from @lintel/core/plugin.`,
    );
  }
  if (plugin.id !== manifest.id) {
    throw new AddonPackageError(
      `Its plugin id is "${plugin.id}" but ${packageName}'s package.json says "${manifest.id}".`,
    );
  }
  const problem = findPluginProblem(plugin);
  if (problem) throw new AddonPackageError(`It isn't quite right: ${problem}`);
  return plugin;
}

/** An add-on with no code: its name and what it says it keeps are all there is to it. */
function dataOnlyPlugin({ manifest, packageName, description }: AddonPackage): LintelPlugin {
  return {
    id: manifest.id,
    name: packageName,
    description: description.trim() || "Says what data it keeps. It has no code of its own.",
  };
}

function isPlugin(value: unknown): value is LintelPlugin {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "name" in value &&
    typeof value.name === "string" &&
    "description" in value &&
    typeof value.description === "string"
  );
}

function missingError(linked: boolean): AddonPackageError {
  return new AddonPackageError(
    linked
      ? "Its folder can't be found. Link it again with lintel addons link."
      : "It isn't installed. Add it again with lintel addons add.",
  );
}

function describeProblem(error: unknown): string {
  if (error instanceof AddonPackageError) return error.message;
  const reason = error instanceof Error ? error.message : String(error);
  return `It failed to load: ${reason}`;
}
