import { ADDON_MODULES_GLOBAL } from "@lintel/core/addon-modules";
import { apiUrl } from "../api/client.js";
import type { AdminPluginDefinition } from "../plugins/adminPlugin.js";
import { addRuntimeAdminPlugins } from "../plugins/adminPlugins.js";
import { listAdminScripts } from "./addons.api.js";
import { sharedAddonModules } from "./sharedAddonModules.js";

/**
 * Loads the admin halves of the site's add-ons before the admin is drawn, so their screens,
 * widgets and field editors are there from the start like Lintel's own. Each is loaded on
 * its own: one that fails is noted (the Add-ons screen says so) and the rest still load,
 * and the admin always starts.
 */

/** Add-ons whose admin half couldn't load this time, by id. */
export const failedAddonAdminHalves = new Set<string>();

export type ImportModule = (url: string) => Promise<unknown>;

const importFromUrl: ImportModule = (url) => import(/* @vite-ignore */ url);

export async function loadAddonAdminHalves(
  importModule: ImportModule = importFromUrl,
): Promise<void> {
  let scripts;
  try {
    ({ scripts } = await listAdminScripts());
  } catch {
    // An older server, or none reachable yet: the admin shows that itself.
    return;
  }
  if (scripts.length === 0) return;
  Object.assign(globalThis, { [ADDON_MODULES_GLOBAL]: sharedAddonModules });
  const loaded = await Promise.all(
    scripts.map(async ({ id, script, styles }) => {
      try {
        if (styles) addStylesheet(`${apiUrl}${styles}`);
        const definition = readDefinition(await importModule(`${apiUrl}${script}`), id);
        return definition ? [definition] : [];
      } catch (error) {
        console.error(`The add-on "${id}" couldn't load its admin screens.`, error);
        failedAddonAdminHalves.add(id);
        return [];
      }
    }),
  );
  addRuntimeAdminPlugins(loaded.flat());
}

/** The module's `defineAdminPlugin({...})`, if it is one for this add-on. */
function readDefinition(loaded: unknown, id: string): AdminPluginDefinition | null {
  const definition =
    typeof loaded === "object" && loaded !== null && "default" in loaded ? loaded.default : null;
  if (
    typeof definition === "object" &&
    definition !== null &&
    "id" in definition &&
    definition.id === id
  ) {
    return definition as AdminPluginDefinition;
  }
  throw new Error(`Its admin file should export default defineAdminPlugin({ id: "${id}", ... }).`);
}

function addStylesheet(href: string): void {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.append(link);
}
