import type { FieldMessages } from "../http/http-errors.js";
import type { NavigationItem } from "./navigation.schema.js";

/**
 * Pure helpers for a menu's tree of items. The rules a saved menu has to follow, checked
 * here so every problem can be shown next to the item it is about (keyed by item id):
 *
 *   - an item links to an entry or to an address, not both and not neither;
 *   - an item with an address has a label (an entry link can use the entry's title);
 *   - no item sits deeper than the menu's `maxDepth`;
 *   - every item id is used once.
 */

/** The most items a menu can have. Far more than any menu needs, to keep saves small. */
export const MAX_NAVIGATION_ITEMS = 500;

export function findNavigationProblems(
  items: readonly NavigationItem[],
  maxDepth: number,
): FieldMessages {
  const problems: Record<string, string> = {};
  const seen = new Set<string>();

  for (const { item, depth } of walkItems(items)) {
    if (seen.has(item.id)) {
      problems[item.id] = "Two menu items can't share an id";
    } else if (item.entryId === null && item.url === null) {
      problems[item.id] = "Choose a page or type an address for this item";
    } else if (item.entryId !== null && item.url !== null) {
      problems[item.id] = "An item can link to a page or an address, not both";
    } else if (item.url !== null && item.label === "") {
      problems[item.id] = "Give this item a label";
    } else if (depth > maxDepth) {
      problems[item.id] =
        maxDepth === 1
          ? "This menu has one level, so items can't go inside other items"
          : `This menu has ${maxDepth} levels, so items can't go any deeper`;
    }
    seen.add(item.id);
  }

  if (seen.size > MAX_NAVIGATION_ITEMS) {
    problems.items = `A menu can have at most ${MAX_NAVIGATION_ITEMS} items`;
  }
  return problems;
}

/** Every item with how deep it sits (1 for the top level), parents before their children. */
export function* walkItems(
  items: readonly NavigationItem[],
  depth = 1,
): Generator<{ item: NavigationItem; depth: number }> {
  for (const item of items) {
    yield { item, depth };
    yield* walkItems(item.children, depth + 1);
  }
}

/** The entries a menu links to, once each. */
export function linkedEntryIds(items: readonly NavigationItem[]): string[] {
  const ids = new Set<string>();
  for (const { item } of walkItems(items)) {
    if (item.entryId !== null) {
      ids.add(item.entryId);
    }
  }
  return [...ids];
}

export function countItems(items: readonly NavigationItem[]): number {
  return [...walkItems(items)].length;
}
