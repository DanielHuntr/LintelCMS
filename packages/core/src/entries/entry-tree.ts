/**
 * Pure helpers for collections whose entries form a tree (pages with child pages).
 * Each entry knows only its parent and its place among its siblings (`sortOrder`).
 */

export interface TreePosition {
  id: string;
  parentId: string | null;
  sortOrder: number;
  createdAt: Date;
}

/**
 * Entry ids in reading order: each parent followed by its children, depth first, with
 * siblings by `sortOrder` (ties by age). An entry whose parent is missing is treated as
 * top level, so nothing ever disappears from the list.
 */
export function orderAsTree(positions: readonly TreePosition[]): string[] {
  const known = new Set(positions.map((position) => position.id));
  const childrenByParent = new Map<string | null, TreePosition[]>();
  for (const position of positions) {
    const parentId = position.parentId && known.has(position.parentId) ? position.parentId : null;
    childrenByParent.set(parentId, [...(childrenByParent.get(parentId) ?? []), position]);
  }
  for (const children of childrenByParent.values()) {
    children.sort(
      (first, second) =>
        first.sortOrder - second.sortOrder ||
        first.createdAt.getTime() - second.createdAt.getTime(),
    );
  }

  const ordered: string[] = [];
  const visited = new Set<string>();
  const visit = (parentId: string | null) => {
    for (const child of childrenByParent.get(parentId) ?? []) {
      // Guards against a loop in hand-edited data; the API never creates one.
      if (visited.has(child.id)) {
        continue;
      }
      visited.add(child.id);
      ordered.push(child.id);
      visit(child.id);
    }
  };
  visit(null);
  return ordered;
}

/** True when following parents up from `entryId` comes back to it. */
export function hasParentLoop(
  entryId: string,
  parentOf: ReadonlyMap<string, string | null>,
): boolean {
  const seen = new Set<string>([entryId]);
  let current = parentOf.get(entryId) ?? null;
  while (current !== null) {
    if (seen.has(current)) {
      return true;
    }
    seen.add(current);
    current = parentOf.get(current) ?? null;
  }
  return false;
}
