import { hasPermission, type Permission } from "@lintel/core/permissions";
import {
  CircleHelp,
  FileText,
  Image,
  LayoutGrid,
  Palette,
  Settings,
  ShoppingBag,
  Users,
  type LucideIcon,
} from "lucide-react";
import { t, type StringKey } from "../i18n/strings.js";
import type { AdminPluginDefinition } from "../plugins/adminPlugin.js";
import { adminPlugins } from "../plugins/adminPlugins.js";
import { visibleExtensions } from "../plugins/pluginContributions.js";

/**
 * The admin's main sections, in the order people use them most.
 * This list is the information architecture from the UX discovery:
 * a client editor typically sees Content, Media and Help; an admin sees everything.
 */
export interface Section {
  path: string;
  label: StringKey;
  /** Shown beside the label in the sidebar. */
  icon: LucideIcon;
  /** The permission needed to see this section. Undefined means everyone can see it. */
  permission?: Permission;
  /** The plugin that provides this section. Without it switched on, the section is hidden. */
  plugin?: string;
}

export const sections: readonly Section[] = [
  { path: "/", label: "nav.dashboard", icon: LayoutGrid },
  { path: "/content", label: "nav.content", permission: "entries:read", icon: FileText },
  { path: "/design", label: "nav.design", permission: "design:read", icon: Palette },
  {
    path: "/commerce",
    label: "nav.commerce",
    permission: "commerce:read",
    plugin: "commerce",
    icon: ShoppingBag,
  },
  { path: "/media", label: "nav.media", permission: "media:read", icon: Image },
  { path: "/users", label: "nav.users", permission: "users:read", icon: Users },
  { path: "/settings", label: "nav.settings", permission: "settings:read", icon: Settings },
  { path: "/help", label: "nav.help", icon: CircleHelp },
];

/** A link in the sidebar, with its label in words: Lintel's own sections and plugins' items. */
export interface NavigationItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

/** Plugins' sidebar items go after this section, among the places people do their work. */
const PLUGIN_ITEMS_AFTER = "/media";

/**
 * The sidebar a person with these permissions sees, leaving out sections whose plugin isn't
 * switched on (a blog has no use for an empty Commerce section), with the sidebar items of
 * switched-on plugins, then installed apps, after Media.
 */
export function visibleSections(
  granted: readonly string[],
  enabledPlugins: readonly string[],
  plugins: readonly AdminPluginDefinition[] = adminPlugins,
  apps: readonly AdminPluginDefinition[] = [],
): NavigationItem[] {
  const own = sections
    .filter(
      (section) =>
        (section.permission === undefined || hasPermission(granted, section.permission)) &&
        (section.plugin === undefined || enabledPlugins.includes(section.plugin)),
    )
    .map((section) => ({ path: section.path, label: t(section.label), icon: section.icon }));
  const fromPlugins = visibleExtensions(plugins, apps, "sidebarItems", {
    permissions: granted,
    enabledPlugins,
  }).map(({ path, label, icon }) => ({ path, label, icon }));

  const insertAt = own.findIndex((section) => section.path === PLUGIN_ITEMS_AFTER) + 1;
  const position = insertAt > 0 ? insertAt : own.length;
  return [...own.slice(0, position), ...fromPlugins, ...own.slice(position)];
}
