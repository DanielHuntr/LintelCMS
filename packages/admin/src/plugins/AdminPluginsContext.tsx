import { createContext, useContext } from "react";
import { useSession } from "../session/SessionContext.js";
import type { AdminPluginDefinition } from "./adminPlugin.js";
import { adminPlugins } from "./adminPlugins.js";
import {
  type ContributionKind,
  type Contributions,
  type FromPlugin,
  visibleContributions,
} from "./pluginContributions.js";

/**
 * The plugins the admin is drawn with. The app uses the real list; tests hand in their own
 * through `AdminPluginsContext.Provider`, so a plugin can be tried without being installed.
 */
export const AdminPluginsContext = createContext<readonly AdminPluginDefinition[]>(adminPlugins);

export function useAdminPlugins(): readonly AdminPluginDefinition[] {
  return useContext(AdminPluginsContext);
}

/** One kind of contribution the signed-in person may see, such as their dashboard widgets. */
export function useVisibleContributions<Kind extends ContributionKind>(
  kind: Kind,
): Array<FromPlugin<Contributions[Kind]>> {
  const plugins = useAdminPlugins();
  const session = useSession();
  return visibleContributions(plugins, kind, session);
}
