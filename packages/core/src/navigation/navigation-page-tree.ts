import type { NavigationItem, PageTreeSettings } from "./navigation.schema.js";

/**
 * A menu that follows the page tree, as Umbraco sites often build theirs: the site's home
 * page first, then the pages under it in the tree's order, with their own children as
 * drop-downs, as deep as the menu's levels allow. Pages hidden from the menu are left out
 * with everything under them. Pure, so the rules are easy to test.
 */

/** A page of the tree: enough to place it in a menu. */
export interface MenuTreePage {
  id: string;
  parentId: string | null;
  sortOrder: number;
}

export function buildPageTreeItems(
  pages: readonly MenuTreePage[],
  homeId: string | null,
  settings: PageTreeSettings,
  maxDepth: number,
): NavigationItem[] {
  if (homeId === null) return [];
  const hidden = new Set(settings.hiddenEntryIds);
  const childrenOf = new Map<string, MenuTreePage[]>();
  for (const page of pages) {
    if (page.parentId === null) continue;
    const siblings = childrenOf.get(page.parentId) ?? [];
    siblings.push(page);
    childrenOf.set(page.parentId, siblings);
  }
  for (const siblings of childrenOf.values()) {
    siblings.sort((first, second) => first.sortOrder - second.sortOrder);
  }

  const itemFor = (page: MenuTreePage, depth: number, seen: Set<string>): NavigationItem => ({
    id: page.id,
    label: settings.labels[page.id] ?? "",
    entryId: page.id,
    url: null,
    newTab: false,
    style: "link",
    children: depth < maxDepth ? itemsUnder(page.id, depth + 1, seen) : [],
  });

  function itemsUnder(parentId: string, depth: number, seen: Set<string>): NavigationItem[] {
    // A broken parent loop would otherwise never end.
    if (seen.has(parentId)) return [];
    const path = new Set(seen).add(parentId);
    return (childrenOf.get(parentId) ?? [])
      .filter((page) => !hidden.has(page.id))
      .map((page) => itemFor(page, depth, path));
  }

  const home = pages.find((page) => page.id === homeId);
  const top = itemsUnder(homeId, 1, new Set());
  if (!home || !settings.includeHome || hidden.has(homeId)) return top;
  return [{ ...itemFor(home, 1, new Set()), children: [] }, ...top];
}

/** The pages the menu would show if nothing were hidden: what "Hide from menu" can be set on. */
export function pagesUnderHome(
  pages: readonly MenuTreePage[],
  homeId: string | null,
  maxDepth: number,
): Set<string> {
  const shown = buildPageTreeItems(
    pages,
    homeId,
    { includeHome: true, hiddenEntryIds: [], labels: {} },
    maxDepth,
  );
  const ids = new Set<string>();
  const visit = (items: readonly NavigationItem[]) => {
    for (const item of items) {
      if (item.entryId) ids.add(item.entryId);
      visit(item.children);
    }
  };
  visit(shown);
  return ids;
}
