import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useState } from "react";
import { t } from "../i18n/strings.js";
import type { EntrySummary } from "./content.types.js";
import { EntryRow } from "./EntryRow.js";
import { moveEntryBy, moveEntryTo, siblingsOf, treeDepths } from "./treeOrder.js";
import { useNow } from "./useNow.js";

interface EntryListProps {
  collectionHandle: string;
  entries: readonly EntrySummary[];
  /** Pages show their nesting; other collections are a flat list. */
  isTree: boolean;
  /** Called with the new order after a drag or a move button. Undefined turns reordering off. */
  onReorder?: (entries: EntrySummary[]) => void;
}

/**
 * The entries of a collection. Rows can be dragged into a new order, or moved with their
 * up and down buttons; pages move along with the pages nested under them.
 */
export function EntryList({ collectionHandle, entries, isTree, onReorder }: EntryListProps) {
  const now = useNow();
  const [announcement, setAnnouncement] = useState("");
  // A few pixels of movement before a drag starts, so clicking a title still opens it.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const depths = isTree ? treeDepths(entries) : new Map<string, number>();

  function reorderTo(reordered: EntrySummary[], movedId: string) {
    if (!onReorder || reordered.every((entry, index) => entry.id === entries[index]?.id)) return;
    onReorder(reordered);
    const siblings = siblingsOf(reordered, movedId);
    const moved = siblings.find((entry) => entry.id === movedId);
    setAnnouncement(
      t("entries.moved", {
        title: moved?.title || t("entries.untitled"),
        position: siblings.findIndex((entry) => entry.id === movedId) + 1,
        count: siblings.length,
      }),
    );
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over) return;
    reorderTo(moveEntryTo(entries, String(active.id), String(over.id)), String(active.id));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={entries.map((entry) => entry.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="overflow-hidden rounded-card bg-surface">
          {entries.map((entry) => {
            const siblings = siblingsOf(entries, entry.id);
            const position = siblings.indexOf(entry);
            return (
              <EntryRow
                key={entry.id}
                collectionHandle={collectionHandle}
                entry={entry}
                depth={depths.get(entry.id) ?? 0}
                now={now}
                reorder={
                  onReorder && {
                    canMoveUp: position > 0,
                    canMoveDown: position < siblings.length - 1,
                    onMove: (direction) =>
                      reorderTo(moveEntryBy(entries, entry.id, direction), entry.id),
                  }
                }
              />
            );
          })}
        </ul>
      </SortableContext>
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </DndContext>
  );
}
