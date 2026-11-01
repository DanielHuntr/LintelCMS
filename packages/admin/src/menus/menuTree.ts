import type { MenuItem } from "./menus.types.js";

/**
 * The menu editor works on the menu as one flat list in reading order, each item with its
 * depth (0 for the top level), the way it is drawn on screen. Moving, indenting and
 * dragging are then simple list operations; `buildMenu` turns the list back into the tree
 * the API stores. An item's children always come straight after it, one level deeper.
 */

export type FlatMenuItem = Omit<MenuItem, "children"> & { depth: number };

export function flattenMenu(items: readonly MenuItem[], depth = 0): FlatMenuItem[] {
  return items.flatMap(({ children, ...item }) => [
    { ...item, depth },
    ...flattenMenu(children, depth + 1),
  ]);
}

export function buildMenu(flat: readonly FlatMenuItem[]): MenuItem[] {
  const roots: MenuItem[] = [];
  // The last item seen at each depth: the parent for anything one level deeper.
  const lastAtDepth: MenuItem[] = [];
  for (const { depth, ...fields } of flat) {
    const item: MenuItem = { ...fields, children: [] };
    const parent = depth > 0 ? lastAtDepth[depth - 1] : undefined;
    if (parent) parent.children.push(item);
    else roots.push(item);
    lastAtDepth[depth] = item;
    lastAtDepth.length = depth + 1;
  }
  return roots;
}

/** Where an item's block (the item and everything inside it) starts and ends. */
function blockOf(flat: readonly FlatMenuItem[], id: string): { start: number; end: number } {
  const start = flat.findIndex((item) => item.id === id);
  if (start === -1) return { start: -1, end: -1 };
  const depth = flat[start]?.depth ?? 0;
  let end = start + 1;
  while (end < flat.length && (flat[end]?.depth ?? 0) > depth) end++;
  return { start, end };
}

/** Moves an item, with its children, one place up or down among its siblings. */
export function moveItemBy(
  flat: readonly FlatMenuItem[],
  id: string,
  direction: -1 | 1,
): FlatMenuItem[] {
  const { start, end } = blockOf(flat, id);
  const depth = flat[start]?.depth;
  if (depth === undefined) return [...flat];
  const block = flat.slice(start, end);
  const rest = [...flat.slice(0, start), ...flat.slice(end)];

  if (direction === -1) {
    // The previous sibling is the nearest earlier item at the same depth, with nothing shallower between.
    let index = start - 1;
    while (index >= 0 && (rest[index]?.depth ?? 0) > depth) index--;
    if (index < 0 || rest[index]?.depth !== depth) return [...flat];
    return [...rest.slice(0, index), ...block, ...rest.slice(index)];
  }

  const next = rest[start];
  if (!next || next.depth !== depth) return [...flat];
  const nextBlock = blockOf(rest, next.id);
  return [...rest.slice(0, nextBlock.end), ...block, ...rest.slice(nextBlock.end)];
}

/** Whether an item can go inside the sibling above it without passing the menu's levels. */
export function canIndent(flat: readonly FlatMenuItem[], id: string, maxDepth: number): boolean {
  const { start, end } = blockOf(flat, id);
  const item = flat[start];
  const previous = flat[start - 1];
  if (!item || !previous || previous.depth < item.depth) return false;
  const deepest = Math.max(...flat.slice(start, end).map((member) => member.depth));
  return deepest + 1 < maxDepth;
}

/** Puts the item (and its children) inside the sibling above it, as its last child. */
export function indentItem(
  flat: readonly FlatMenuItem[],
  id: string,
  maxDepth: number,
): FlatMenuItem[] {
  if (!canIndent(flat, id, maxDepth)) return [...flat];
  const { start, end } = blockOf(flat, id);
  return flat.map((item, index) =>
    index >= start && index < end ? { ...item, depth: item.depth + 1 } : item,
  );
}

export function canOutdent(flat: readonly FlatMenuItem[], id: string): boolean {
  return (flat.find((item) => item.id === id)?.depth ?? 0) > 0;
}

/**
 * Takes the item (and its children) out of its parent, to sit just after it. Its later
 * siblings stay where they are, inside the parent.
 */
export function outdentItem(flat: readonly FlatMenuItem[], id: string): FlatMenuItem[] {
  if (!canOutdent(flat, id)) return [...flat];
  const { start, end } = blockOf(flat, id);
  const depth = flat[start]?.depth ?? 0;
  let parentIndex = start - 1;
  while (parentIndex >= 0 && (flat[parentIndex]?.depth ?? 0) >= depth) parentIndex--;
  const parent = flat[parentIndex];
  if (!parent) return [...flat];

  const block = flat.slice(start, end).map((item) => ({ ...item, depth: item.depth - 1 }));
  const rest = [...flat.slice(0, start), ...flat.slice(end)];
  const parentEnd = blockOf(rest, parent.id).end;
  return [...rest.slice(0, parentEnd), ...block, ...rest.slice(parentEnd)];
}

/**
 * Drops a dragged item (with its children) where another item is. It keeps its depth
 * where it can, but never goes deeper than one level below the item now above it.
 */
export function moveItemTo(
  flat: readonly FlatMenuItem[],
  id: string,
  targetId: string,
): FlatMenuItem[] {
  const { start, end } = blockOf(flat, id);
  const target = flat.findIndex((item) => item.id === targetId);
  if (start === -1 || target === -1 || (target >= start && target < end)) return [...flat];

  const block = flat.slice(start, end);
  const rest = [...flat.slice(0, start), ...flat.slice(end)];
  const targetInRest = rest.findIndex((item) => item.id === targetId);
  const movingDown = target > start;
  const insertAt = movingDown ? blockOf(rest, targetId).end : targetInRest;

  const above = rest[insertAt - 1];
  const newDepth = Math.min(block[0]?.depth ?? 0, above ? above.depth + 1 : 0);
  const shift = newDepth - (block[0]?.depth ?? 0);
  const moved = block.map((item) => ({ ...item, depth: item.depth + shift }));
  return [...rest.slice(0, insertAt), ...moved, ...rest.slice(insertAt)];
}

/** Removes the item and everything inside it. */
export function removeItem(flat: readonly FlatMenuItem[], id: string): FlatMenuItem[] {
  const { start, end } = blockOf(flat, id);
  if (start === -1) return [...flat];
  return [...flat.slice(0, start), ...flat.slice(end)];
}

/** How many items the item carries with it, itself included, for "Remove" confirmations. */
export function blockSize(flat: readonly FlatMenuItem[], id: string): number {
  const { start, end } = blockOf(flat, id);
  return start === -1 ? 0 : end - start;
}
