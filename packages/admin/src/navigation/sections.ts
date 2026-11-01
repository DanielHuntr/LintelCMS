import { hasPermission, type Permission } from "@lintel/core/permissions";
import {
  CircleHelp,
  FileText,
  Image,
  LayoutGrid,
  ListChecks,
  Palette,
  Settings,
  ShoppingBag,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { StringKey } from "../i18n/strings.js";

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
  {
    path: "/forms",
    label: "nav.forms",
    permission: "forms:read",
    plugin: "forms",
    icon: ListChecks,
  },
  { path: "/users", label: "nav.users", permission: "users:read", icon: Users },
  {
    path: "/automations",
    label: "nav.automations",
    permission: "workflows:read",
    plugin: "automations",
    icon: Workflow,
  },
  { path: "/settings", label: "nav.settings", permission: "settings:read", icon: Settings },
  { path: "/help", label: "nav.help", icon: CircleHelp },
];

/**
 * The sections a person with these permissions may see, leaving out sections whose plugin
 * isn't switched on: a blog has no use for an empty Commerce section.
 */
export function visibleSections(
  granted: readonly string[],
  enabledPlugins: readonly string[],
): Section[] {
  return sections.filter(
    (section) =>
      (section.permission === undefined || hasPermission(granted, section.permission)) &&
      (section.plugin === undefined || enabledPlugins.includes(section.plugin)),
  );
}
