import type { EntrySummary } from "./content.types.js";

/**
 * Pages form a tree, but the API sends them as one list in tree order: each page, then its
 * children, then its next sibling. These helpers work on that list without rebuilding a tree.
 */

/** How deep each entry sits: 0 for top-level pages. Parents missing from the list count as top level. */
export function treeDepths(
  entries: readonly Pick<EntrySummary, "id" | "parentId">[],
): Map<string, number> {
  const depths = new Map<string, number>();
  for (const entry of entries) {
    const parentDepth = entry.parentId ? depths.get(entry.parentId) : undefined;
    depths.set(entry.id, parentDepth === undefined ? 0 : parentDepth + 1);
  }
  return depths;
}

/** The ids of an entry and everything nested under it. */
export function subtreeIds(
  entries: readonly Pick<EntrySummary, "id" | "parentId">[],
  rootId: string,
): Set<string> {
  const ids = new Set([rootId]);
  // Tree order means descendants come straight after their ancestor.
  for (const entry of entries) {
    if (entry.parentId && ids.has(entry.parentId)) ids.add(entry.id);
  }
  return ids;
}

/** Entries that share a parent with this one, in order, including itself. */
export function siblingsOf<Item extends Pick<EntrySummary, "id" | "parentId">>(
  entries: readonly Item[],
  entryId: string,
): Item[] {
  const entry = entries.find((candidate) => candidate.id === entryId);
  if (!entry) return [];
  return entries.filter((candidate) => candidate.parentId === entry.parentId);
}

/**
 * Moves an entry, with everything nested under it, to where `targetId` (a sibling) is.
 * In a flat list every entry is a sibling, so this is a plain move. Returns the list
 * unchanged when the target isn't a sibling: pages change parent in the editor, not here.
 */
export function moveEntryTo<Item extends Pick<EntrySummary, "id" | "parentId">>(
  entries: readonly Item[],
  entryId: string,
  targetId: string,
): Item[] {
  const entry = entries.find((candidate) => candidate.id === entryId);
  const target = entries.find((candidate) => candidate.id === targetId);
  if (!entry || !target || entry.parentId !== target.parentId || entryId === targetId) {
    return [...entries];
  }

  const siblings = siblingsOf(entries, entryId);
  const movingDown = siblings.indexOf(entry) < siblings.indexOf(target);
  const moving = subtreeIds(entries, entryId);
  const block = entries.filter((candidate) => moving.has(candidate.id));
  const rest = entries.filter((candidate) => !moving.has(candidate.id));

  // Moving down lands after the target's own children; moving up lands right before it.
  const targetBlock = subtreeIds(rest, targetId);
  const targetIndex = rest.findIndex((candidate) => candidate.id === targetId);
  const insertAt = movingDown ? targetIndex + targetBlock.size : targetIndex;
  return [...rest.slice(0, insertAt), ...block, ...rest.slice(insertAt)];
}

/** Moves an entry one place up or down among its siblings, for the keyboard buttons. */
export function moveEntryBy<Item extends Pick<EntrySummary, "id" | "parentId">>(
  entries: readonly Item[],
  entryId: string,
  direction: -1 | 1,
): Item[] {
  const siblings = siblingsOf(entries, entryId);
  const index = siblings.findIndex((sibling) => sibling.id === entryId);
  const target = siblings[index + direction];
  return target ? moveEntryTo(entries, entryId, target.id) : [...entries];
}
