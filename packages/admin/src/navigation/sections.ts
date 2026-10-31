import { hasPermission, type Permission } from "@lintel/core/permissions";
import type { StringKey } from "../i18n/strings.js";

/**
 * The admin's main sections, in the order people use them most.
 * This list is the information architecture from the UX discovery:
 * a client editor typically sees Content, Media and Help; an admin sees everything.
 */
export interface Section {
  path: string;
  label: StringKey;
  /** The permission needed to see this section. Undefined means everyone can see it. */
  permission?: Permission;
}

export const sections: readonly Section[] = [
  { path: "/", label: "nav.dashboard" },
  { path: "/content", label: "nav.content", permission: "entries:read" },
  { path: "/design", label: "nav.design", permission: "design:read" },
  { path: "/commerce", label: "nav.commerce", permission: "commerce:read" },
  { path: "/media", label: "nav.media", permission: "media:read" },
  { path: "/forms", label: "nav.forms", permission: "forms:read" },
  { path: "/users", label: "nav.users", permission: "users:read" },
  { path: "/settings", label: "nav.settings", permission: "settings:read" },
  { path: "/help", label: "nav.help" },
];

/** The sections a person with these permissions is allowed to see. */
export function visibleSections(granted: readonly string[]): Section[] {
  return sections.filter(
    (section) => section.permission === undefined || hasPermission(granted, section.permission),
  );
}
