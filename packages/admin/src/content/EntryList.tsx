import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useState } from "react";
import { t } from "../i18n/strings.js";
import type { EntrySummary } from "./content.types.js";
import { EntryRow, INDENT_PIXELS } from "./EntryRow.js";
import {
  moveEntryBy,
  moveEntryInTree,
  moveEntryTo,
  moveOutOfParent,
  nestUnderPreviousSibling,
  projectTreeDrop,
  siblingsOf,
  treeDepths,
} from "./treeOrder.js";
import { useNow } from "./useNow.js";

interface EntryListProps {
  collectionHandle: string;
  entries: readonly EntrySummary[];
  /** Pages show their nesting; other collections are a flat list. */
  isTree: boolean;
  /** Called with the new order after a drag or a move button. Undefined turns reordering off. */
  onReorder?: (entries: EntrySummary[]) => void;
}

interface DragState {
  activeId: string;
  overId: string;
  /** How many indents right (or, negative, left) the pointer has moved since the drag began. */
  depthChange: number;
}

/**
 * The entries of a collection. Rows can be dragged into a new order, or moved with their
 * up and down buttons; pages move along with the pages nested under them. In a page tree,
 * dragging a page right or left changes its parent, and each row has buttons that do the
 * same for keyboard and screen reader users.
 */
export function EntryList({ collectionHandle, entries, isTree, onReorder }: EntryListProps) {
  const now = useNow();
  const [announcement, setAnnouncement] = useState("");
  const [drag, setDrag] = useState<DragState | null>(null);
  // A few pixels of movement before a drag starts, so clicking a title still opens it.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const depths = isTree ? treeDepths(entries) : new Map<string, number>();
  const projection =
    isTree && drag ? projectTreeDrop(entries, drag.activeId, drag.overId, drag.depthChange) : null;
  const titleOf = (entry: EntrySummary | undefined) => entry?.title || t("entries.untitled");

  function reorderTo(reordered: EntrySummary[], movedId: string) {
    const unchanged = reordered.every(
      (entry, index) =>
        entry.id === entries[index]?.id && entry.parentId === entries[index]?.parentId,
    );
    if (!onReorder || unchanged) return;
    onReorder(reordered);

    const moved = reordered.find((entry) => entry.id === movedId);
    const before = entries.find((entry) => entry.id === movedId);
    if (moved && before && moved.parentId !== before.parentId) {
      const parent = reordered.find((entry) => entry.id === moved.parentId);
      setAnnouncement(
        parent
          ? t("entries.nested", { title: titleOf(moved), parent: titleOf(parent) })
          : t("entries.unnested", { title: titleOf(moved) }),
      );
      return;
    }
    const siblings = siblingsOf(reordered, movedId);
    setAnnouncement(
      t("entries.moved", {
        title: titleOf(moved),
        position: siblings.findIndex((entry) => entry.id === movedId) + 1,
        count: siblings.length,
      }),
    );
  }

  function handleDragStart({ active }: DragStartEvent) {
    setDrag({ activeId: String(active.id), overId: String(active.id), depthChange: 0 });
  }

  function handleDragMove({ delta }: DragMoveEvent) {
    const depthChange = Math.round(delta.x / INDENT_PIXELS);
    setDrag((current) =>
      current && current.depthChange !== depthChange ? { ...current, depthChange } : current,
    );
  }

  function handleDragOver({ over }: DragOverEvent) {
    if (!over) return;
    setDrag((current) => current && { ...current, overId: String(over.id) });
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    const activeId = String(active.id);
    setDrag(null);
    if (!over) return;
    if (!isTree) {
      reorderTo(moveEntryTo(entries, activeId, String(over.id)), activeId);
      return;
    }
    if (projection) {
      reorderTo(moveEntryInTree(entries, activeId, String(over.id), projection.parentId), activeId);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      // Pages also move sideways (to change parent), so only flat lists are held to one axis.
      modifiers={isTree ? [] : [restrictToVerticalAxis]}
      onDragStart={handleDragStart}
      onDragMove={isTree ? handleDragMove : undefined}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDrag(null)}
    >
      <SortableContext
        items={entries.map((entry) => entry.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="overflow-hidden rounded-card bg-surface">
          {entries.map((entry) => {
            const siblings = siblingsOf(entries, entry.id);
            const position = siblings.indexOf(entry);
            const parent = entries.find((candidate) => candidate.id === entry.parentId);
            const previousSibling = siblings[position - 1];
            const isDragged = drag?.activeId === entry.id;
            return (
              <EntryRow
                key={entry.id}
                collectionHandle={collectionHandle}
                entry={entry}
                depth={isDragged && projection ? projection.depth : (depths.get(entry.id) ?? 0)}
                now={now}
                lockHorizontalMovement={isTree}
                reorder={
                  onReorder && {
                    canMoveUp: position > 0,
                    canMoveDown: position < siblings.length - 1,
                    onMove: (direction) =>
                      reorderTo(moveEntryBy(entries, entry.id, direction), entry.id),
                    nest:
                      isTree && previousSibling
                        ? {
                            label: t("entries.nest", {
                              title: titleOf(entry),
                              parent: titleOf(previousSibling),
                            }),
                            onSelect: () =>
                              reorderTo(nestUnderPreviousSibling(entries, entry.id), entry.id),
                          }
                        : undefined,
                    unnest:
                      isTree && parent
                        ? {
                            label: t("entries.unnest", {
                              title: titleOf(entry),
                              parent: titleOf(parent),
                            }),
                            onSelect: () => reorderTo(moveOutOfParent(entries, entry.id), entry.id),
                          }
                        : undefined,
                  }
                }
              />
            );
          })}
        </ul>
      </SortableContext>
      {isTree && onReorder && (
        <p className="mt-3 px-1 text-footnote text-label-secondary">{t("entries.treeHint")}</p>
      )}
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </DndContext>
  );
}
