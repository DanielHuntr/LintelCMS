import { type ComponentCatalogue, findPlace, type PageNode } from "@lintel/builder-model";

/**
 * Where a dragged layer lands: before or after the row it is over, or inside it. The top
 * and bottom quarters of a row mean before and after; the middle means inside, when the row
 * can hold it (otherwise the nearer edge).
 */
export type DropPosition = "before" | "after" | "inside";

export function dropPositionAt(
  offsetY: number,
  rowHeight: number,
  canHoldChildren: boolean,
): DropPosition {
  const ratio = rowHeight > 0 ? offsetY / rowHeight : 0.5;
  if (!canHoldChildren) return ratio < 0.5 ? "before" : "after";
  if (ratio < 0.25) return "before";
  if (ratio > 0.75) return "after";
  return "inside";
}

/** The parent and index a drop at `position` of `target` means, or null if it can't go there. */
export function dropPlace(
  root: PageNode,
  catalogue: ComponentCatalogue,
  target: PageNode,
  position: DropPosition,
  draggedType: string,
): { parentId: string; index: number } | null {
  if (position === "inside") {
    return catalogue.canContain(target.type, draggedType)
      ? { parentId: target.id, index: target.children.length }
      : null;
  }
  const place = findPlace(root, target.id);
  if (!place || !catalogue.canContain(place.parent.type, draggedType)) return null;
  return { parentId: place.parent.id, index: place.index + (position === "after" ? 1 : 0) };
}

/** The drag data types the Layers panel accepts: a layer being moved, or something new. */
export const layerDragType = "application/x-lintel-layer";
export const insertDragType = "application/x-lintel-insert";
