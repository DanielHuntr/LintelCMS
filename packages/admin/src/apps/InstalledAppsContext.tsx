import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { AdminPluginDefinition } from "../plugins/adminPlugin.js";
import { useAppExtensions } from "./apps.queries.js";
import { AppToastsProvider } from "./AppToasts.js";
import { appAsAdminPlugin } from "./installedAppPlugins.js";

/**
 * Installed apps, as admin plugin definitions. Unlike plugins they aren't switched on and
 * off: an app is on while it is installed. Screens and tests without the provider see none.
 */
export const InstalledAppsContext = createContext<readonly AdminPluginDefinition[]>([]);

export function useInstalledApps(): readonly AdminPluginDefinition[] {
  return useContext(InstalledAppsContext);
}

/**
 * Loads the installed apps' parts of the admin once someone is signed in. If that fails the
 * admin carries on without them; Build → Apps shows the problem.
 */
export function InstalledAppsProvider({ children }: { children: ReactNode }) {
  const extensions = useAppExtensions();
  // The query keeps the same data object until it changes, so frames aren't redrawn.
  const apps = useMemo(() => (extensions.data ?? []).map(appAsAdminPlugin), [extensions.data]);
  return (
    <InstalledAppsContext.Provider value={apps}>
      <AppToastsProvider>{children}</AppToastsProvider>
    </InstalledAppsContext.Provider>
  );
}
