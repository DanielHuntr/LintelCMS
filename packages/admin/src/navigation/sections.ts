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
}

export const sections: readonly Section[] = [
  { path: "/", label: "nav.dashboard", icon: LayoutGrid },
  { path: "/content", label: "nav.content", permission: "entries:read", icon: FileText },
  { path: "/design", label: "nav.design", permission: "design:read", icon: Palette },
  { path: "/commerce", label: "nav.commerce", permission: "commerce:read", icon: ShoppingBag },
  { path: "/media", label: "nav.media", permission: "media:read", icon: Image },
  { path: "/forms", label: "nav.forms", permission: "forms:read", icon: ListChecks },
  { path: "/users", label: "nav.users", permission: "users:read", icon: Users },
  { path: "/settings", label: "nav.settings", permission: "settings:read", icon: Settings },
  { path: "/help", label: "nav.help", icon: CircleHelp },
];

/** The sections a person with these permissions is allowed to see. */
export function visibleSections(granted: readonly string[]): Section[] {
  return sections.filter(
    (section) => section.permission === undefined || hasPermission(granted, section.permission),
  );
}
