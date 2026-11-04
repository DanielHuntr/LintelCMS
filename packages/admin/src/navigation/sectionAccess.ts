import { hasPermission, type Permission } from "@lintel/core/permissions";
import { adminPlugins } from "../plugins/adminPlugins.js";
import type { AdminPluginDefinition } from "../plugins/adminPlugin.js";

/**
 * Who may open each area of the admin by its address. Wider than the sidebar on purpose: a
 * custom role with only `backups:read` has no Settings link in some cases, but its Backups
 * screen still has to open. The API refuses the data either way; this is so that someone
 * who types an address gets a plain answer instead of a screen that can't load.
 */
const areas: readonly { path: string; anyPermission: readonly Permission[] }[] = [
  {
    path: "/settings",
    anyPermission: ["settings:read", "backups:read", "updates:read", "privacy:manage"],
  },
  {
    path: "/build",
    anyPermission: [
      "blueprints:update",
      "settings:read",
      "settings:update",
      "branding:update",
      "content:transfer",
    ],
  },
  {
    path: "/users",
    anyPermission: ["users:read", "roles:update", "security:read", "settings:read"],
  },
  { path: "/design", anyPermission: ["builder:design"] },
  { path: "/commerce", anyPermission: ["commerce:read", "commerce:read-orders"] },
];

const isInside = (pathname: string, area: string) =>
  pathname === area || pathname.startsWith(`${area}/`);

/** Whether someone with these permissions may open this address. */
export function canOpenPath(
  pathname: string,
  granted: readonly string[],
  plugins: readonly AdminPluginDefinition[] = adminPlugins,
): boolean {
  const area = areas.find(({ path }) => isInside(pathname, path));
  if (area && !area.anyPermission.some((permission) => hasPermission(granted, permission))) {
    return false;
  }
  const item = plugins
    .flatMap((plugin) => plugin.sidebarItems ?? [])
    .find(({ path }) => isInside(pathname, path));
  return !item?.permission || hasPermission(granted, item.permission);
}
