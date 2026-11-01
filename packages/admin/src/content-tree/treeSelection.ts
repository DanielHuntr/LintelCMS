import { useCallback, useRef, useState } from "react";
import type { TreeNode } from "./contentTree.types.js";
import type { TreeKey } from "./treeState.js";

/**
 * Choosing several entries in the tree at once, as in a file manager: Ctrl- or ⌘-click (or
 * Space) adds or takes away one, Shift-click (or Shift and an arrow key) picks the run of
 * rows from the last one picked, and Escape clears. The rules are plain functions here, so
 * tests can call them; `useTreeSelection` keeps the state.
 */

export type SelectGesture = "toggle" | "range";

export interface Selection {
  ids: ReadonlySet<string>;
  /** Where a Shift-click run starts: the last entry picked on its own. */
  anchor: string | null;
}

export const emptySelection: Selection = { ids: new Set(), anchor: null };

export function toggleSelected(selection: Selection, id: string): Selection {
  const ids = new Set(selection.ids);
  if (ids.has(id)) ids.delete(id);
  else ids.add(id);
  return { ids, anchor: id };
}

/**
 * The run of rows from the anchor to `id`, in the order the tree shows them (`visible`).
 * Without an anchor (or one that has scrolled out of the tree) it is just `id`.
 */
export function selectRange(
  selection: Selection,
  id: string,
  visible: readonly TreeKey[],
  fallbackAnchor: string | null = null,
): Selection {
  const anchor = selection.anchor ?? fallbackAnchor;
  const from = anchor === null ? -1 : visible.indexOf(anchor);
  const to = visible.indexOf(id);
  if (from === -1 || to === -1) return { ids: new Set([id]), anchor: id };
  const [start, end] = from <= to ? [from, to] : [to, from];
  return { ids: new Set(visible.slice(start, end + 1)), anchor };
}

/** The entry rows the tree shows, top to bottom (sections and site-wide folders left out). */
export function visibleEntryKeys(tree: Element | null): TreeKey[] {
  if (!tree) return [];
  return [...tree.querySelectorAll<HTMLElement>("[data-tree-row][data-key]")]
    .map((row) => row.dataset.key ?? "")
    .filter((key) => key !== "" && !key.includes(":"));
}

/** The selection, with the tree nodes behind it, for the selection bar's actions. */
export function useTreeSelection(treeElement: () => Element | null) {
  const [selection, setSelection] = useState<Selection>(emptySelection);
  const [nodes, setNodes] = useState<readonly TreeNode[]>([]);
  const known = useRef(new Map<string, TreeNode>());

  const rememberNode = useCallback((node: TreeNode) => {
    known.current.set(node.id, node);
  }, []);

  const latest = useRef(emptySelection);

  // Changes come from clicks and keys, so the rows' nodes are read there, never in render.
  const change = useCallback((next: (current: Selection) => Selection) => {
    const updated = next(latest.current);
    latest.current = updated;
    setSelection(updated);
    setNodes(
      [...updated.ids].flatMap((id) => {
        const node = known.current.get(id);
        return node ? [node] : [];
      }),
    );
  }, []);

  const select = useCallback(
    (node: TreeNode, gesture: SelectGesture, fallbackAnchor: string | null = null) => {
      known.current.set(node.id, node);
      const visible = visibleEntryKeys(treeElement());
      change((current) =>
        gesture === "toggle"
          ? toggleSelected(current, node.id)
          : selectRange(current, node.id, visible, fallbackAnchor),
      );
    },
    [treeElement, change],
  );

  /** Shift and an arrow key: the run from the anchor to the row focus moved to. */
  const extendTo = useCallback(
    (key: TreeKey, fromKey: TreeKey) => {
      if (key.includes(":")) return;
      const visible = visibleEntryKeys(treeElement());
      change((current) =>
        selectRange(
          current.anchor === null ? { ids: new Set([fromKey]), anchor: fromKey } : current,
          key,
          visible,
        ),
      );
    },
    [treeElement, change],
  );

  const clear = useCallback(() => change(() => emptySelection), [change]);

  return { ids: selection.ids, nodes, select, extendTo, clear, rememberNode };
}
