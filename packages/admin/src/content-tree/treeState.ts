import { useCallback, useEffect, useState } from "react";

/**
 * The tree's small rules, kept apart from the components so tests can call them directly:
 * what stays expanded, how wide the pane is, and where a dragged row lands.
 */

export const TREE_WIDTH = { minimum: 220, default: 280, maximum: 480 } as const;

/** Keeps a width the person dragged to within what leaves room for the workspace. */
export function clampTreeWidth(width: number): number {
  if (!Number.isFinite(width)) return TREE_WIDTH.default;
  return Math.round(Math.min(TREE_WIDTH.maximum, Math.max(TREE_WIDTH.minimum, width)));
}

/** A tree key: an entry id, or "root:<handle>" for a collection's section, "site:<area>" for the rest. */
export type TreeKey = string;

export function rootKey(collectionHandle: string): TreeKey {
  return `root:${collectionHandle}`;
}

/** The open branches, with one switched. */
export function toggled(expanded: ReadonlySet<TreeKey>, key: TreeKey): Set<TreeKey> {
  const next = new Set(expanded);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

/** Reads a saved list of keys, ignoring anything that isn't one. */
export function parseKeys(saved: string | null): Set<TreeKey> {
  if (!saved) return new Set();
  try {
    const parsed: unknown = JSON.parse(saved);
    return new Set(
      Array.isArray(parsed) ? parsed.filter((key): key is string => typeof key === "string") : [],
    );
  } catch {
    return new Set();
  }
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private windows can refuse storage; the tree then just forgets between visits.
  }
}

/** Which branches are open, remembered per site in this browser. */
export function useExpandedBranches(siteKey: string) {
  const storageKey = `lintel.contentTree.expanded.${siteKey}`;
  const [expanded, setExpanded] = useState(() => parseKeys(readStorage(storageKey)));
  const [loadedKey, setLoadedKey] = useState(storageKey);

  // Another site's branches, when the site switcher changes. Adjusted during render.
  if (loadedKey !== storageKey) {
    setLoadedKey(storageKey);
    setExpanded(parseKeys(readStorage(storageKey)));
  }

  useEffect(() => {
    writeStorage(storageKey, JSON.stringify([...expanded]));
  }, [storageKey, expanded]);

  return {
    expanded,
    toggle: useCallback((key: TreeKey) => setExpanded((current) => toggled(current, key)), []),
    /** Opens these branches (and keeps the rest as they are), to show a selected entry. */
    open: useCallback(
      (keys: readonly TreeKey[]) =>
        setExpanded((current) =>
          keys.every((key) => current.has(key)) ? current : new Set([...current, ...keys]),
        ),
      [],
    ),
  };
}

/** The pane's width, remembered in this browser. */
export function useTreeWidth() {
  const storageKey = "lintel.contentTree.width";
  const [width, setWidth] = useState(() => clampTreeWidth(Number(readStorage(storageKey) ?? NaN)));
  useEffect(() => writeStorage(storageKey, String(width)), [width]);
  return { width, setWidth: (next: number) => setWidth(clampTreeWidth(next)) };
}

/**
 * Whether the pane is open, remembered in this browser. On a phone it starts folded, so the
 * page comes first; on wider screens it starts open.
 */
export function useTreeShown() {
  const storageKey = "lintel.contentTree.shown";
  const [isShown, setIsShown] = useState(() => {
    const stored = readStorage(storageKey);
    if (stored === "yes" || stored === "no") return stored === "yes";
    return (
      typeof window.matchMedia !== "function" || window.matchMedia("(min-width: 768px)").matches
    );
  });
  const choose = (shown: boolean) => {
    setIsShown(shown);
    writeStorage(storageKey, shown ? "yes" : "no");
  };
  return { isShown, choose };
}

export type DropPosition = "before" | "inside" | "after";

/**
 * Where a row dropped on another lands: the top quarter puts it before, the bottom quarter
 * after, and the middle inside (when the target can take children; otherwise the nearer edge).
 */
export function dropPosition(offsetY: number, rowHeight: number, canNest: boolean): DropPosition {
  const ratio = rowHeight > 0 ? offsetY / rowHeight : 0.5;
  if (!canNest) return ratio < 0.5 ? "before" : "after";
  if (ratio < 0.25) return "before";
  if (ratio > 0.75) return "after";
  return "inside";
}

/**
 * The parent and place a drop asks for. `siblingIds` are the target's siblings in order,
 * as the tree shows them; the dragged entry may be among them.
 */
export function moveForDrop(
  draggedId: string,
  target: { id: string; parentId: string | null },
  position: DropPosition,
  siblingIds: readonly string[],
): { parentId: string | null; index: number } {
  if (position === "inside") {
    return { parentId: target.id, index: Number.MAX_SAFE_INTEGER };
  }
  const others = siblingIds.filter((id) => id !== draggedId);
  const targetIndex = others.indexOf(target.id);
  const index = targetIndex === -1 ? others.length : targetIndex + (position === "after" ? 1 : 0);
  return { parentId: target.parentId, index };
}
