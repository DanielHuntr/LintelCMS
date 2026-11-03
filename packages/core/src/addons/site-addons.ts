import type { LintelPlugin } from "../plugins/plugin-definition.js";
import { pluginRegistry } from "../plugins/plugins.registry.js";
import { lintelVersion } from "../updates/lintel-version.js";
import { addonsFolderIn } from "./addons-list.js";
import { type AddonsState, loadAddons } from "./load-addons.js";

/**
 * The add-ons installed in a Lintel folder, for main.ts and the production server: loaded
 * after the built-in plugins and the ones from lintel.config.ts, whose ids they can't take.
 */
export function loadSiteAddons(
  lintelRoot: string,
  configPlugins: readonly LintelPlugin[],
): Promise<AddonsState> {
  return loadAddons(addonsFolderIn(lintelRoot), {
    lintelVersion: lintelVersion(),
    takenIds: [...pluginRegistry, ...configPlugins].map((plugin) => plugin.id),
  });
}
