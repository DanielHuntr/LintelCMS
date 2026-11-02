import { closestCenter, DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useState } from "react";
import { isSameValue } from "../content/sameValue.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { t } from "../i18n/strings.js";
import { MenuItemRow, menuItemLabel } from "./MenuItemRow.js";
import {
  blockSize,
  canIndent,
  canOutdent,
  type FlatMenuItem,
  indentItem,
  moveItemBy,
  moveItemTo,
  outdentItem,
  removeItem,
  shiftDepth,
} from "./menuTree.js";
import type { MenuDraft } from "./useMenuDraft.js";

/** How far a row is dragged sideways to go in (or out) one level. */
const LEVEL_WIDTH_PX = 28;

/**
 * A hand-made menu's items as an indented list. Drag a row up or down to move it, and to
 * the right to put it inside the item above (a drop-down), or to the left to take it out;
 * or use its buttons, which do the same from the keyboard. Each move is announced.
 */
export function MenuItemsList({
  draft,
  onEdit,
  compact = false,
}: {
  draft: MenuDraft;
  onEdit: (item: FlatMenuItem) => void;
  compact?: boolean;
}) {
  const { items, change, linkedEntries, problems, maxDepth } = draft;
  const [itemToRemove, setItemToRemove] = useState<FlatMenuItem | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const canMove = (id: string, direction: -1 | 1) =>
    !isSameValue(moveItemBy(items, id, direction), items);

  function remove(item: FlatMenuItem) {
    if (blockSize(items, item.id) > 1) setItemToRemove(item);
    else change(removeItem(items, item.id));
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={({ active, over, delta }) => {
          const id = String(active.id);
          const levels = Math.round(delta.x / LEVEL_WIDTH_PX);
          const moved =
            over && over.id !== active.id ? moveItemTo(items, id, String(over.id)) : items;
          const nested = levels === 0 ? moved : shiftDepth(moved, id, levels, maxDepth);
          if (!isSameValue(nested, items)) change(nested, id);
        }}
      >
        <SortableContext
          items={items.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul aria-label={t("menus.items")} className="overflow-hidden rounded-card bg-surface">
            {items.map((item) => (
              <MenuItemRow
                key={item.id}
                item={item}
                compact={compact}
                linkedEntry={item.entryId ? linkedEntries[item.entryId] : undefined}
                problem={problems[item.id]}
                canMoveUp={canMove(item.id, -1)}
                canMoveDown={canMove(item.id, 1)}
                canIndent={canIndent(items, item.id, maxDepth)}
                canOutdent={canOutdent(items, item.id)}
                onMove={(direction) => change(moveItemBy(items, item.id, direction), item.id)}
                onIndent={() => change(indentItem(items, item.id, maxDepth), item.id)}
                onOutdent={() => change(outdentItem(items, item.id), item.id)}
                onEdit={() => onEdit(item)}
                onRemove={() => remove(item)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <p className="mt-2 px-1 text-caption text-label-secondary">{t("menus.dragHint")}</p>
      <p role="status" className="sr-only">
        {draft.announcement}
      </p>
      <ConfirmDialog
        open={itemToRemove !== null}
        title={t("menus.removeTitle", {
          label: itemToRemove
            ? menuItemLabel(itemToRemove, linkedEntries[itemToRemove.entryId ?? ""])
            : "",
        })}
        message={t("menus.removeMessage")}
        confirmLabel={t("menus.item.remove")}
        cancelLabel={t("common.cancel")}
        isDestructive
        onCancel={() => setItemToRemove(null)}
        onConfirm={() => {
          if (itemToRemove) change(removeItem(items, itemToRemove.id));
          setItemToRemove(null);
        }}
      />
    </>
  );
}
