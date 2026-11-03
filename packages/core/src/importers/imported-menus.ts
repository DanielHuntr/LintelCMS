import { randomUUID } from "node:crypto";
import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import {
  findNavigationByHandle,
  insertNavigationIfMissing,
  updateNavigationRow,
} from "../navigation/navigation.repository.js";
import type { NavigationItem } from "../navigation/navigation.schema.js";
import { navigationItemSchema } from "../navigation/navigation.schema.js";

/**
 * A menu from another system, saved as a Lintel menu. Every importer that brings menus
 * (WordPress menus, Statamic navigation) ends here, so they follow the same rules:
 *
 * - The menu's handle comes from its name ("Footer links" is `footer_links`). A menu
 *   already here with that handle and no items (such as the empty Main menu every site
 *   starts with) is filled in; one with items of its own is left alone and the import
 *   gets a handle of its own (`footer_links_2`).
 * - Links to pages that came in become links to those entries, so they follow the page's
 *   address; typed addresses stay as they are if they're safe ones (https://, mailto:...).
 *   Anything else is left out and counted.
 */
export interface ImportedMenuLink {
  label: string;
  entryId: string | null;
  url: string | null;
  newTab?: boolean;
  children: ImportedMenuLink[];
}

export interface SavedMenu {
  navigationId: string;
  handle: string;
  /** Links left out: to something that didn't come in, or to an address that isn't safe. */
  leftOut: number;
}

const MAX_ITEMS = 500;
const MAX_DEPTH = 5;

export async function saveImportedMenu(
  database: DatabaseOrTransaction,
  siteId: string,
  menu: { name: string; links: readonly ImportedMenuLink[] },
): Promise<SavedMenu> {
  const counter = { kept: 0, leftOut: 0 };
  const items = toItems(menu.links, 1, counter);
  const maxDepth = Math.max(1, Math.min(MAX_DEPTH, deepestLevel(items)));
  const name = menu.name.trim().slice(0, 100) || "Imported menu";
  const base = menuHandle(name);

  for (let attempt = 1; attempt < 50; attempt += 1) {
    const handle = attempt === 1 ? base : `${base.slice(0, 60)}_${attempt}`;
    const existing = await findNavigationByHandle(database, DEFAULT_TENANT_ID, siteId, handle);
    if (existing && existing.items.length > 0) {
      continue;
    }
    if (existing) {
      await updateNavigationRow(database, existing.id, {
        items,
        maxDepth: Math.max(existing.maxDepth, maxDepth),
      });
      return { navigationId: existing.id, handle, leftOut: counter.leftOut };
    }
    const inserted = await insertNavigationIfMissing(database, {
      tenantId: DEFAULT_TENANT_ID,
      siteId,
      handle,
      name,
      maxDepth,
      items,
    });
    if (inserted) {
      return { navigationId: inserted.id, handle, leftOut: counter.leftOut };
    }
  }
  throw new Error(`No free handle for the menu "${name}"`);
}

/** "Main menu" → `main_menu`; handles start with a letter. */
export function menuHandle(name: string): string {
  const handle = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return /^[a-z]/.test(handle) ? handle : `menu_${handle}`.replace(/_+$/, "");
}

function toItems(
  links: readonly ImportedMenuLink[],
  level: number,
  counter: { kept: number; leftOut: number },
): NavigationItem[] {
  const items: NavigationItem[] = [];
  for (const link of links) {
    if (level > MAX_DEPTH || counter.kept >= MAX_ITEMS) {
      counter.leftOut += 1 + countLinks(link.children);
      continue;
    }
    const parsed = navigationItemSchema.safeParse({
      id: randomUUID(),
      label: (link.label.trim() || (link.entryId ? "" : (link.url ?? ""))).slice(0, 100),
      entryId: link.entryId,
      url: link.entryId ? null : link.url,
      newTab: link.newTab ?? false,
      children: [],
    });
    if (!parsed.success || (!parsed.data.entryId && !parsed.data.url)) {
      counter.leftOut += 1 + countLinks(link.children);
      continue;
    }
    counter.kept += 1;
    items.push({ ...parsed.data, children: toItems(link.children, level + 1, counter) });
  }
  return items;
}

function countLinks(links: readonly ImportedMenuLink[]): number {
  return links.reduce((total, link) => total + 1 + countLinks(link.children), 0);
}

function deepestLevel(items: readonly NavigationItem[]): number {
  return items.reduce((deepest, item) => Math.max(deepest, 1 + deepestLevel(item.children)), 0);
}
