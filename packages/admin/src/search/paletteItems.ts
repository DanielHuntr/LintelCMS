import { hasPermission } from "@lintel/core/permissions";
import type { LucideIcon } from "lucide-react";
import { FileText, FolderOpen, Image, Shapes } from "lucide-react";
import type { Collection, EntryStatus } from "../content/content.types.js";
import { t, type StringKey } from "../i18n/strings.js";
import { visibleSections } from "../navigation/sections.js";
import type { SearchResults } from "./search.types.js";

/**
 * What the command palette lists, built from the admin's own pages (filtered by permission,
 * like the sidebar) and the API's search results. Pure functions, so tests can check them.
 */

export type PaletteTarget =
  | { kind: "page"; path: string }
  | { kind: "collection"; collectionHandle: string }
  | { kind: "entry"; collectionHandle: string; entryId: string }
  | { kind: "asset"; assetId: string; filename: string };

export type PaletteGroup = "pages" | "entries" | "media";

export interface PaletteItem {
  id: string;
  group: PaletteGroup;
  label: string;
  detail?: string;
  icon?: LucideIcon;
  thumbnailUrl?: string | null;
  target: PaletteTarget;
}

interface SettingsPage {
  path: string;
  label: StringKey;
  description: StringKey;
  permission: `${string}:${string}`;
  /** The plugin that provides the screen, when it only exists while that plugin is on. */
  plugin?: string;
}

/** Settings screens that aren't in the sidebar. Add new ones here as they are built. */
const settingsPages: readonly SettingsPage[] = [
  {
    path: "/settings/content-types",
    label: "contentTypes.title",
    description: "settings.contentTypesDescription",
    permission: "blueprints:read",
  },
  {
    path: "/content/globals",
    label: "globals.title",
    description: "contentModel.globalsDescription",
    permission: "globals:read",
  },
  {
    path: "/content/navigation",
    label: "menus.title",
    description: "contentModel.menusDescription",
    permission: "navigation:read",
  },
  {
    path: "/content/taxonomies",
    label: "taxonomies.title",
    description: "contentModel.taxonomiesDescription",
    permission: "taxonomies:read",
  },
  {
    path: "/settings/languages",
    label: "languages.title",
    description: "settings.languagesDescription",
    permission: "settings:read",
  },
  {
    path: "/settings/api",
    label: "apiAccess.title",
    description: "settings.apiAccessDescription",
    permission: "settings:read",
  },
  {
    path: "/settings/webhooks",
    label: "webhooks.title",
    description: "settings.webhooksDescription",
    permission: "settings:read",
  },
  {
    path: "/settings/seo",
    label: "seo.settingsTitle",
    description: "settings.seoDescription",
    permission: "settings:read",
    plugin: "seo",
  },
];

/** Every word typed has to start a word of the text: "con ty" finds "Content types". */
export function matchesWords(text: string, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  const textWords = text.toLowerCase().split(/[^\p{L}\p{N}]+/u);
  return words.every((word) => textWords.some((textWord) => textWord.startsWith(word)));
}

/** The admin's pages and collections that match, for the "Go to" group. */
export function matchingPages(
  query: string,
  context: {
    permissions: readonly string[];
    enabledPlugins: readonly string[];
    collections: readonly Collection[];
  },
): PaletteItem[] {
  const sections: PaletteItem[] = visibleSections(context.permissions, context.enabledPlugins).map(
    (section) => ({
      id: `page:${section.path}`,
      group: "pages",
      label: t(section.label),
      icon: section.icon,
      target: { kind: "page", path: section.path },
    }),
  );
  const settings: PaletteItem[] = settingsPages
    .filter(
      (page) =>
        hasPermission(context.permissions, page.permission) &&
        (page.plugin === undefined || context.enabledPlugins.includes(page.plugin)),
    )
    .map((page) => ({
      id: `page:${page.path}`,
      group: "pages",
      label: t(page.label),
      detail: t(page.description),
      icon: Shapes,
      target: { kind: "page", path: page.path },
    }));
  const collections: PaletteItem[] = hasPermission(context.permissions, "entries:read")
    ? context.collections.map((collection) => ({
        id: `collection:${collection.handle}`,
        group: "pages",
        label: collection.name,
        detail: t("search.collectionDetail", { name: collection.name }),
        icon: FolderOpen,
        target: { kind: "collection", collectionHandle: collection.handle },
      }))
    : [];

  return [...sections, ...settings, ...collections].filter((item) =>
    matchesWords(`${item.label} ${item.detail ?? ""}`, query),
  );
}

const statusKeys: Record<EntryStatus, StringKey> = {
  draft: "entry.status.draft",
  published: "entry.status.published",
  scheduled: "entry.status.scheduled",
};

/** The API's results as palette rows: entries, then media. */
export function resultItems(results: SearchResults | undefined): PaletteItem[] {
  const entries: PaletteItem[] = (results?.entries ?? []).map((entry) => ({
    id: `entry:${entry.id}`,
    group: "entries",
    label: entry.title || t("entries.untitled"),
    detail: t("search.entryDetail", {
      collection: entry.collection.name,
      status: t(statusKeys[entry.status]),
    }),
    icon: FileText,
    target: { kind: "entry", collectionHandle: entry.collection.handle, entryId: entry.id },
  }));
  const assets: PaletteItem[] = (results?.assets ?? []).map((asset) => ({
    id: `asset:${asset.id}`,
    group: "media",
    label: asset.filename,
    detail: asset.alt || undefined,
    icon: Image,
    thumbnailUrl: asset.thumbnailUrl,
    target: { kind: "asset", assetId: asset.id, filename: asset.filename },
  }));
  return [...entries, ...assets];
}
