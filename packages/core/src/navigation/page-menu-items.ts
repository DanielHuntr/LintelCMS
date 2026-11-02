import { randomUUID } from "node:crypto";
import { walkItems } from "./navigation-items.js";
import type { NavigationItem } from "./navigation.schema.js";

/**
 * "In the main menu" on a page, for a menu arranged by hand: where a page's item goes when
 * it is switched on, and what happens to the items around it when it is switched off. Pure,
 * so the rules are easy to test.
 */

/** Where a page sits in the tree: what decides where its menu item goes. */
export interface PagePlace {
  entryId: string;
  parentId: string | null;
  /** Its parent is the site start, whose children sit beside it in a menu, not under it. */
  isUnderHome: boolean;
  /** The ids of the page and its siblings, in the tree's order. */
  siblingIds: readonly string[];
}

export function findPageItem(
  items: readonly NavigationItem[],
  entryId: string,
): NavigationItem | undefined {
  for (const { item } of walkItems(items)) {
    if (item.entryId === entryId) return item;
  }
  return undefined;
}

/**
 * Adds an item for the page, under its parent's item when the parent is in the menu (and
 * the menu has a level for it), beside its siblings' items in the tree's order. A page
 * already in the menu only gets its label changed.
 */
export function addPageItem(
  items: readonly NavigationItem[],
  place: PagePlace,
  label: string,
  maxDepth: number,
): NavigationItem[] {
  if (findPageItem(items, place.entryId)) {
    return labelPageItems(items, place.entryId, label);
  }
  const item: NavigationItem = {
    id: randomUUID(),
    label,
    entryId: place.entryId,
    url: null,
    newTab: false,
    style: "link",
    children: [],
  };
  const parent = place.isUnderHome || place.parentId === null ? undefined : place.parentId;
  const parentDepth = parent === undefined ? undefined : depthOfPage(items, parent);
  if (parent !== undefined && parentDepth !== undefined && parentDepth < maxDepth) {
    const parentItem = findPageItem(items, parent);
    return mapItems(items, (candidate) =>
      candidate === parentItem
        ? { ...candidate, children: insertAmongSiblings(candidate.children, item, place) }
        : candidate,
    );
  }
  return insertAmongSiblings(items, item, place);
}

/**
 * Takes the page's items out of the menu. Items someone put inside them move up into their
 * place, so switching one page off never takes other links with it.
 */
export function removePageItems(
  items: readonly NavigationItem[],
  entryId: string,
): NavigationItem[] {
  return items.flatMap((item) => {
    const children = removePageItems(item.children, entryId);
    return item.entryId === entryId ? children : [{ ...item, children }];
  });
}

export function labelPageItems(
  items: readonly NavigationItem[],
  entryId: string,
  label: string,
): NavigationItem[] {
  return mapItems(items, (item) => (item.entryId === entryId ? { ...item, label } : item));
}

function mapItems(
  items: readonly NavigationItem[],
  change: (item: NavigationItem) => NavigationItem,
): NavigationItem[] {
  return items.map((item) => {
    const changed = change(item);
    return { ...changed, children: mapItems(changed.children, change) };
  });
}

function depthOfPage(items: readonly NavigationItem[], entryId: string): number | undefined {
  for (const { item, depth } of walkItems(items)) {
    if (item.entryId === entryId) return depth;
  }
  return undefined;
}

/**
 * Puts the item after the last item for a sibling that comes before the page in the tree,
 * or before the first that comes after it, or at the end.
 */
function insertAmongSiblings(
  list: readonly NavigationItem[],
  item: NavigationItem,
  place: PagePlace,
): NavigationItem[] {
  const position = place.siblingIds.indexOf(place.entryId);
  const before = new Set(position === -1 ? [] : place.siblingIds.slice(0, position));
  const after = new Set(position === -1 ? [] : place.siblingIds.slice(position + 1));
  const lastBefore = list.findLastIndex(
    (candidate) => candidate.entryId !== null && before.has(candidate.entryId),
  );
  if (lastBefore !== -1) {
    return [...list.slice(0, lastBefore + 1), item, ...list.slice(lastBefore + 1)];
  }
  const firstAfter = list.findIndex(
    (candidate) => candidate.entryId !== null && after.has(candidate.entryId),
  );
  if (firstAfter !== -1) {
    return [...list.slice(0, firstAfter), item, ...list.slice(firstAfter)];
  }
  // Buttons ("Book now") usually end a menu, so a new page goes before them.
  const firstButton = list.findIndex((candidate) => candidate.style === "button");
  if (firstButton !== -1) {
    return [...list.slice(0, firstButton), item, ...list.slice(firstButton)];
  }
  return [...list, item];
}
