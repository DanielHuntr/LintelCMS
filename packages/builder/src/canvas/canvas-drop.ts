import { type ComponentCatalogue, findNode, findPlace, type PageNode } from "@lintel/builder-model";
import { dropPlace, dropPositionAt, type DropPosition } from "../panels/layer-drop.js";

/** Where the pointer is over one element: `ratio` of the way down it, or along it in a row. */
export interface PointerOver {
  nodeId: string;
  ratio: number;
  /** The element sits in a row, so it's measured left to right and its line is upright. */
  across: boolean;
}

/** Where something dragged from Insert would land on the canvas, and where to draw the line. */
export interface CanvasDropTarget {
  /** The element the line is drawn against. */
  nodeId: string;
  position: DropPosition;
  across: boolean;
  place: { parentId: string; index: number };
}

/**
 * The drop for the pointer over `chain`: the element under it first, then each one around it.
 * An element that can't take what's dragged (before, after or inside it) hands the drop to
 * the one around it. A whole section goes between the page's sections, never inside one.
 * Over the page itself (an empty chain), it goes at the end.
 */
export function canvasDropTarget(
  root: PageNode,
  catalogue: ComponentCatalogue,
  draggedType: string,
  chain: readonly PointerOver[],
): CanvasDropTarget | null {
  const isSection = draggedType === "section";
  const candidates = isSection
    ? chain.filter((over) => findPlace(root, over.nodeId)?.parent.id === root.id)
    : chain;
  for (const over of candidates) {
    const node = findNode(root, over.nodeId);
    if (!node) continue;
    const canHold = !isSection && catalogue.canContain(node.type, draggedType);
    const position = dropPositionAt(Math.min(Math.max(over.ratio, 0), 1), 1, canHold);
    const place = dropPlace(root, catalogue, node, position, draggedType);
    if (place) return { nodeId: node.id, position, across: over.across, place };
  }
  return endOfPage(root, catalogue, draggedType);
}

function endOfPage(
  root: PageNode,
  catalogue: ComponentCatalogue,
  draggedType: string,
): CanvasDropTarget | null {
  if (!catalogue.canContain(root.type, draggedType)) return null;
  const place = { parentId: root.id, index: root.children.length };
  const last = root.children.at(-1);
  return last
    ? { nodeId: last.id, position: "after", across: false, place }
    : { nodeId: root.id, position: "inside", across: false, place };
}
