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

type TreeItem = Pick<EntrySummary, "id" | "parentId">;

/**
 * Puts a list back in tree order (each page, then its children, then its next sibling),
 * keeping siblings in the order they appear. Used after a page changes parent.
 */
export function inTreeOrder<Item extends TreeItem>(entries: readonly Item[]): Item[] {
  const ids = new Set(entries.map((entry) => entry.id));
  const childrenOf = new Map<string | null, Item[]>();
  for (const entry of entries) {
    // A parent that isn't in the list (on another page of results) counts as the top level.
    const parentId = entry.parentId && ids.has(entry.parentId) ? entry.parentId : null;
    childrenOf.set(parentId, [...(childrenOf.get(parentId) ?? []), entry]);
  }
  const ordered: Item[] = [];
  const visit = (parentId: string | null) => {
    for (const child of childrenOf.get(parentId) ?? []) {
      ordered.push(child);
      visit(child.id);
    }
  };
  visit(null);
  return ordered;
}

/**
 * The list as it looks while a page is dragged over `overId`: the page's own subtree taken
 * out, and the page put where the target is (after it when moving down, before it when up).
 * Returns null when the target is the page itself or one of its own children.
 */
function placeDragged<Item extends TreeItem>(
  entries: readonly Item[],
  activeId: string,
  overId: string,
): { list: Item[]; index: number; descendants: Item[] } | null {
  const moving = subtreeIds(entries, activeId);
  const active = entries.find((entry) => entry.id === activeId);
  if (!active || moving.has(overId)) return null;

  const rest = entries.filter((entry) => !moving.has(entry.id));
  const movingDown =
    entries.findIndex((entry) => entry.id === activeId) <
    entries.findIndex((entry) => entry.id === overId);
  const overIndex = rest.findIndex((entry) => entry.id === overId);
  if (overIndex === -1) return null;
  const index = movingDown ? overIndex + 1 : overIndex;
  return {
    list: [...rest.slice(0, index), active, ...rest.slice(index)],
    index,
    descendants: entries.filter((entry) => moving.has(entry.id) && entry.id !== activeId),
  };
}

/**
 * Where a dragged page would land, and under which parent. Dragging right by one indent
 * (`depthChange` of 1) nests it under the page above; dragging left moves it out. The depth
 * is kept to what makes sense there: at most one deeper than the page above, and no
 * shallower than the page below (which would otherwise lose its parent).
 */
export function projectTreeDrop<Item extends TreeItem>(
  entries: readonly Item[],
  activeId: string,
  overId: string,
  depthChange: number,
): { depth: number; parentId: string | null } | null {
  const placed =
    activeId === overId ? placeInPlace(entries, activeId) : placeDragged(entries, activeId, overId);
  if (!placed) return null;
  const depths = treeDepths(entries);
  const depthOf = (entry: Item | undefined) => (entry ? (depths.get(entry.id) ?? 0) : 0);

  const previous = placed.list[placed.index - 1];
  const next = placed.list[placed.index + 1];
  const maxDepth = previous ? depthOf(previous) + 1 : 0;
  const minDepth = next ? depthOf(next) : 0;
  const wanted = depthOf(placed.list[placed.index]) + depthChange;
  const depth = Math.max(minDepth, Math.min(maxDepth, wanted));

  if (depth === 0 || !previous) return { depth: 0, parentId: null };
  if (depth === depthOf(previous)) return { depth, parentId: previous.parentId };
  if (depth > depthOf(previous)) return { depth, parentId: previous.id };
  // Shallower than the page above: the parent is that page's ancestor at this depth.
  const sameDepth = placed.list
    .slice(0, placed.index)
    .reverse()
    .find((entry) => depthOf(entry) === depth);
  return { depth, parentId: sameDepth?.parentId ?? null };
}

/** Dropping a page where it already is, but further left or right. */
function placeInPlace<Item extends TreeItem>(entries: readonly Item[], activeId: string) {
  const moving = subtreeIds(entries, activeId);
  const active = entries.find((entry) => entry.id === activeId);
  if (!active) return null;
  const rest = entries.filter((entry) => !moving.has(entry.id) || entry.id === activeId);
  return {
    list: rest,
    index: rest.indexOf(active),
    descendants: entries.filter((entry) => moving.has(entry.id) && entry.id !== activeId),
  };
}

/** Moves a page (with its subtree) to where `overId` is, under `parentId`. */
export function moveEntryInTree<Item extends TreeItem>(
  entries: readonly Item[],
  activeId: string,
  overId: string,
  parentId: string | null,
): Item[] {
  const placed =
    activeId === overId ? placeInPlace(entries, activeId) : placeDragged(entries, activeId, overId);
  if (!placed) return [...entries];
  const list = placed.list.flatMap((entry) =>
    entry.id === activeId ? [{ ...entry, parentId }, ...placed.descendants] : [entry],
  );
  return inTreeOrder(list);
}

/** Puts a page under the sibling above it, as that page's last child. */
export function nestUnderPreviousSibling<Item extends TreeItem>(
  entries: readonly Item[],
  entryId: string,
): Item[] {
  const siblings = siblingsOf(entries, entryId);
  const previous = siblings[siblings.findIndex((sibling) => sibling.id === entryId) - 1];
  if (!previous) return [...entries];
  return inTreeOrder(
    entries.map((entry) => (entry.id === entryId ? { ...entry, parentId: previous.id } : entry)),
  );
}

/** Moves a page out of its parent, to sit straight after it. */
export function moveOutOfParent<Item extends TreeItem>(
  entries: readonly Item[],
  entryId: string,
): Item[] {
  const entry = entries.find((candidate) => candidate.id === entryId);
  const parent = entries.find((candidate) => candidate.id === entry?.parentId);
  if (!entry || !parent) return [...entries];

  const moving = subtreeIds(entries, entryId);
  const block = entries
    .filter((candidate) => moving.has(candidate.id))
    .map((candidate) =>
      candidate.id === entryId ? { ...candidate, parentId: parent.parentId } : candidate,
    );
  const rest = entries.filter((candidate) => !moving.has(candidate.id));
  const parentBlock = subtreeIds(rest, parent.id);
  const insertAt = rest.findIndex((candidate) => candidate.id === parent.id) + parentBlock.size;
  return inTreeOrder([...rest.slice(0, insertAt), ...block, ...rest.slice(insertAt)]);
}
