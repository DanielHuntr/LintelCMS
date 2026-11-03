import { hasPermission } from "@lintel/core/permissions";
import type { LucideIcon } from "lucide-react";
import {
  FilePlus2,
  Hammer,
  ImageUp,
  LogOut,
  MonitorSmartphone,
  Moon,
  Settings,
  Sun,
  UserPlus,
} from "lucide-react";
import type { ColorSchemeChoice } from "../appearance/colorScheme.js";
import type { Collection } from "../content/content.types.js";
import { t, type StringKey } from "../i18n/strings.js";
import { visibleSections } from "../navigation/sections.js";
import { matchesWords, type PaletteItem } from "./paletteItems.js";

/**
 * The command palette's actions: things to do rather than places to go, such as "New page"
 * or "Sign out". Each is listed only when it matches what was typed and the person may do
 * it, with the same permissions the screens they lead to check. Pure, so tests can check them.
 */

export type PaletteAction =
  | { kind: "newEntry"; collectionHandle: string }
  | { kind: "upload" }
  | { kind: "invite" }
  | { kind: "colorScheme"; choice: ColorSchemeChoice }
  | { kind: "signOut" };

export interface PaletteActionContext {
  permissions: readonly string[];
  enabledPlugins: readonly string[];
  collections: readonly Collection[];
  /** The scheme chosen in this browser, and what the admin shows now. */
  colorScheme: { choice: ColorSchemeChoice; current: "light" | "dark" };
}

interface ActionDefinition {
  id: string;
  label: string;
  /** Other words people type for it ("log out" for Sign out), matched but not shown. */
  keywords: StringKey;
  icon: LucideIcon;
  target: PaletteItem["target"];
}

export function matchingActions(query: string, context: PaletteActionContext): PaletteItem[] {
  return availableActions(context)
    .filter((action) => matchesWords(`${action.label} ${t(action.keywords)}`, query))
    .map(({ id, label, icon, target }) => ({ id, group: "actions", label, icon, target }));
}

function availableActions(context: PaletteActionContext): ActionDefinition[] {
  const may = (permission: `${string}:${string}`) => hasPermission(context.permissions, permission);
  const sections = visibleSections(context.permissions, context.enabledPlugins);
  const isVisible = (path: string) => sections.some((section) => section.path === path);
  const actions: ActionDefinition[] = [];

  if (may("entries:create")) {
    // "New page" first: it's what most people come for.
    const pagesFirst = [...context.collections].sort(
      (one, other) => Number(other.handle === "pages") - Number(one.handle === "pages"),
    );
    for (const collection of pagesFirst) {
      actions.push({
        id: `action:new:${collection.handle}`,
        label:
          collection.handle === "pages"
            ? t("search.action.newPage")
            : t("search.action.newEntry", { collection: collection.name }),
        keywords: "search.action.newKeywords",
        icon: FilePlus2,
        target: {
          kind: "action",
          action: { kind: "newEntry", collectionHandle: collection.handle },
        },
      });
    }
  }
  if (may("media:upload")) {
    actions.push({
      id: "action:upload",
      label: t("search.action.upload"),
      keywords: "search.action.uploadKeywords",
      icon: ImageUp,
      target: { kind: "action", action: { kind: "upload" } },
    });
  }
  if (isVisible("/settings")) {
    actions.push({
      id: "action:settings",
      label: t("search.action.openSettings"),
      keywords: "search.action.openSettingsKeywords",
      icon: Settings,
      target: { kind: "page", path: "/settings" },
    });
  }
  if (isVisible("/build")) {
    actions.push({
      id: "action:build",
      label: t("search.action.openBuild"),
      keywords: "search.action.openBuildKeywords",
      icon: Hammer,
      target: { kind: "page", path: "/build" },
    });
  }
  if (may("users:invite")) {
    actions.push({
      id: "action:invite",
      label: t("search.action.invite"),
      keywords: "search.action.inviteKeywords",
      icon: UserPlus,
      target: { kind: "action", action: { kind: "invite" } },
    });
  }
  actions.push(...colorSchemeActions(context.colorScheme));
  actions.push({
    id: "action:sign-out",
    label: t("search.action.signOut"),
    keywords: "search.action.signOutKeywords",
    icon: LogOut,
    target: { kind: "action", action: { kind: "signOut" } },
  });
  return actions;
}

/** The other scheme, and the device's setting once someone has chosen one. */
function colorSchemeActions({ choice, current }: PaletteActionContext["colorScheme"]) {
  const switchTo: ColorSchemeChoice = current === "dark" ? "light" : "dark";
  const actions: ActionDefinition[] = [
    {
      id: "action:color-scheme",
      label: t(switchTo === "dark" ? "search.action.darkMode" : "search.action.lightMode"),
      keywords: "search.action.modeKeywords",
      icon: switchTo === "dark" ? Moon : Sun,
      target: { kind: "action", action: { kind: "colorScheme", choice: switchTo } },
    },
  ];
  if (choice !== "device") {
    actions.push({
      id: "action:color-scheme-device",
      label: t("search.action.deviceMode"),
      keywords: "search.action.modeKeywords",
      icon: MonitorSmartphone,
      target: { kind: "action", action: { kind: "colorScheme", choice: "device" } },
    });
  }
  return actions;
}

/**
 * The palette's rows in order: places to go (named as typed, so most likely what was
 * meant), then actions, then content and media from the API. "Go to" rows that lead where
 * an action does ("Settings" beside "Open Settings") are left out, so each is offered once.
 */
export function inPaletteOrder(
  pages: readonly PaletteItem[],
  actions: readonly PaletteItem[],
  results: readonly PaletteItem[],
): PaletteItem[] {
  const actionPaths = new Set(
    actions.flatMap((action) => (action.target.kind === "page" ? [action.target.path] : [])),
  );
  const places = pages.filter(
    (item) => !(item.target.kind === "page" && actionPaths.has(item.target.path)),
  );
  return [...places, ...actions, ...results];
}
