import type { PageNode } from "../document/page-document.schema.js";

/**
 * Bring forward, send back, bring to front and send to back, for elements that overlap.
 * Only `z-index` changes, never the order in Layers, because that order is the order the
 * page is read in.
 *
 * The siblings' stacking is worked out from their z-index (unset counts as 0, ties go by
 * Layers order, as browsers do), the element is moved, and every sibling that overlaps gets
 * a z-index of 1, 2, 3... so the result is simple to read in the stylesheet.
 */
export type StackingMove = "forward" | "backward" | "front" | "back";

export function restack(
  siblings: readonly PageNode[],
  nodeId: string,
  move: StackingMove,
): Map<string, string> | null {
  const stacked = siblings
    .map((node, index) => ({ node, index, z: Number.parseInt(node.styles.base.zIndex ?? "0", 10) }))
    .sort((first, second) => (first.z || 0) - (second.z || 0) || first.index - second.index)
    .map((entry) => entry.node.id);
  const from = stacked.indexOf(nodeId);
  if (from === -1) return null;
  const to = {
    forward: Math.min(stacked.length - 1, from + 1),
    backward: Math.max(0, from - 1),
    front: stacked.length - 1,
    back: 0,
  }[move];
  if (to === from) return null;
  stacked.splice(from, 1);
  stacked.splice(to, 0, nodeId);
  return new Map(stacked.map((id, position) => [id, String(position + 1)]));
}
