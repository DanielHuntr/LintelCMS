import { closestCenter, DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Ellipsis, ListTree, Plus, Settings2, Trash2 } from "lucide-react";
import { useState } from "react";
import { ApiError, type FieldMessages } from "../api/client.js";
import { describeError } from "../api/describeError.js";
import { isSameValue } from "../content/sameValue.js";
import { useLeaveWarning } from "../content/useLeaveWarning.js";
import { BackLink } from "../design/BackLink.js";
import { Button } from "../design/Button.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { EmptyState } from "../design/EmptyState.js";
import { useContentModelEditable } from "../content-model-sync/contentModelSync.queries.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { Menu as ActionsMenu } from "../design/Menu.js";
import { t, tCount } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { MenuItemRow, menuItemLabel } from "./MenuItemRow.js";
import { MenuItemSheet } from "./MenuItemSheet.js";
import { MenuSettingsSheet } from "./MenuSettingsSheet.js";
import {
  blockSize,
  buildMenu,
  canIndent,
  canOutdent,
  type FlatMenuItem,
  flattenMenu,
  indentItem,
  moveItemBy,
  moveItemTo,
  outdentItem,
  removeItem,
} from "./menuTree.js";
import { deleteMenu, saveMenu } from "./menus.api.js";
import { menuKeys } from "./menus.queries.js";
import type { LinkedEntry, Menu } from "./menus.types.js";

type Editing = { item: FlatMenuItem | null } | null;

/**
 * A menu's items as an indented list. Drag a row to move it, or use its buttons: up and
 * down among its siblings, in (under the item above) and out (back up a level). Changes are
 * saved together with Save.
 */
export function MenuEditor({ menu }: { menu: Menu }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const canEdit = useCan("navigation:update");
  // The menu's name and levels are part of the content model; its items are content.
  const canChangeSettings = useContentModelEditable();
  const [saved, setSaved] = useState(() => flattenMenu(menu.items));
  const [items, setItems] = useState(saved);
  const [settings, setSettings] = useState({ name: menu.name, maxDepth: menu.maxDepth });
  const [linkedEntries, setLinkedEntries] = useState<Record<string, LinkedEntry>>(
    menu.linkedEntries,
  );
  const [editing, setEditing] = useState<Editing>(null);
  const [itemToRemove, setItemToRemove] = useState<FlatMenuItem | null>(null);
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [problems, setProblems] = useState<FieldMessages>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const isUnsaved = !isSameValue(saved, items);
  const leaveWarning = useLeaveWarning(isUnsaved);

  function change(next: FlatMenuItem[], movedId?: string) {
    setItems(next);
    if (movedId) {
      const index = next.findIndex((item) => item.id === movedId);
      const moved = next[index];
      if (moved) {
        setAnnouncement(
          t("menus.moved", {
            label: menuItemLabel(moved, linkedEntries[moved.entryId ?? ""]),
            position: index + 1,
            count: next.length,
            level: moved.depth + 1,
          }),
        );
      }
    }
  }

  async function save() {
    setIsSaving(true);
    setSaveError(null);
    try {
      const updated = await saveMenu(menu.handle, { items: buildMenu(items) });
      queryClient.setQueryData(menuKeys.menu(menu.handle), updated);
      void queryClient.invalidateQueries({ queryKey: menuKeys.menus() });
      const fresh = flattenMenu(updated.items);
      setSaved(fresh);
      setItems(fresh);
      setLinkedEntries(updated.linkedEntries);
      setProblems({});
    } catch (error) {
      setProblems(error instanceof ApiError ? (error.fields ?? {}) : {});
      setSaveError(describeError(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function saveSettings(name: string, maxDepth: number) {
    const updated = await saveMenu(menu.handle, { name, maxDepth });
    setSettings({ name: updated.name, maxDepth: updated.maxDepth });
    void queryClient.invalidateQueries({ queryKey: menuKeys.menus() });
    setIsEditingSettings(false);
  }

  async function confirmDelete() {
    try {
      await deleteMenu(menu.handle);
      await queryClient.invalidateQueries({ queryKey: menuKeys.menus() });
      await navigate({ to: "/content/navigation", ignoreBlocker: true });
    } catch (error) {
      setSaveError(describeError(error));
      setIsDeleting(false);
    }
  }

  function removeNow(item: FlatMenuItem) {
    change(removeItem(items, item.id));
    setItemToRemove(null);
    setEditing(null);
  }

  const canMove = (id: string, direction: -1 | 1) =>
    !isSameValue(moveItemBy(items, id, direction), items);

  return (
    <>
      <BackLink to="/content/navigation">{t("menus.title")}</BackLink>
      <LargeTitle
        title={settings.name}
        subtitle={tCount(
          { one: "menus.levels.one", other: "menus.levels.other" },
          settings.maxDepth,
        )}
        actions={
          canEdit && (
            <>
              {canChangeSettings && (
                <ActionsMenu
                  label={t("menus.moreActions", { name: settings.name })}
                  trigger={<Ellipsis aria-hidden="true" className="size-5" />}
                  items={[
                    {
                      label: t("menus.settings"),
                      icon: Settings2,
                      onSelect: () => setIsEditingSettings(true),
                    },
                    {
                      label: t("menus.delete"),
                      icon: Trash2,
                      tone: "danger",
                      onSelect: () => setIsDeleting(true),
                    },
                  ]}
                />
              )}
              <Button
                variant="tinted"
                icon={<Plus aria-hidden="true" />}
                onClick={() => setEditing({ item: null })}
              >
                {t("menus.addItem")}
              </Button>
              <Button onClick={() => void save()} disabled={isSaving || !isUnsaved}>
                {isSaving ? t("builder.saving") : t("menus.save")}
              </Button>
            </>
          )
        }
      />

      {saveError && (
        <p
          role="alert"
          className="mb-6 rounded-card bg-danger/10 px-4 py-3 text-footnote text-label"
        >
          {saveError}
        </p>
      )}

      {items.length === 0 ? (
        <div className="rounded-card bg-surface">
          <EmptyState
            size="page"
            icon={ListTree}
            title={t("menus.emptyItemsTitle")}
            description={t("menus.emptyItemsDescription")}
            action={
              canEdit && (
                <Button
                  onClick={() => setEditing({ item: null })}
                  icon={<Plus aria-hidden="true" />}
                >
                  {t("menus.addItem")}
                </Button>
              )
            }
          />
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={({ active, over }) => {
            if (!over || active.id === over.id) return;
            change(moveItemTo(items, String(active.id), String(over.id)), String(active.id));
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
                  linkedEntry={item.entryId ? linkedEntries[item.entryId] : undefined}
                  problem={problems[item.id]}
                  canMoveUp={canMove(item.id, -1)}
                  canMoveDown={canMove(item.id, 1)}
                  canIndent={canIndent(items, item.id, settings.maxDepth)}
                  canOutdent={canOutdent(items, item.id)}
                  onMove={(direction) => change(moveItemBy(items, item.id, direction), item.id)}
                  onIndent={() => change(indentItem(items, item.id, settings.maxDepth), item.id)}
                  onOutdent={() => change(outdentItem(items, item.id), item.id)}
                  onEdit={() => setEditing({ item })}
                  onRemove={() =>
                    blockSize(items, item.id) > 1 ? setItemToRemove(item) : removeNow(item)
                  }
                />
              ))}
            </ul>
          </SortableContext>
          <p className="mt-3 px-1 text-footnote text-label-secondary">{t("menus.hint")}</p>
          <p role="status" className="sr-only">
            {announcement}
          </p>
        </DndContext>
      )}

      {editing && (
        <MenuItemSheet
          item={editing.item}
          linkedTitle={
            editing.item?.entryId ? linkedEntries[editing.item.entryId]?.title : undefined
          }
          onSave={(changed, picked) => {
            if (picked) {
              setLinkedEntries((current) => ({
                ...current,
                [picked.id]: {
                  title: picked.title,
                  collectionHandle: picked.collectionHandle,
                  status: picked.status,
                },
              }));
            }
            const existing = editing.item;
            change(
              existing
                ? items.map((item) =>
                    item.id === existing.id ? { ...changed, depth: item.depth } : item,
                  )
                : [...items, { ...changed, depth: 0 }],
            );
            setEditing(null);
          }}
          onRemove={
            editing.item
              ? () => {
                  const item = editing.item;
                  if (!item) return;
                  setEditing(null);
                  if (blockSize(items, item.id) > 1) setItemToRemove(item);
                  else removeNow(item);
                }
              : undefined
          }
          onClose={() => setEditing(null)}
        />
      )}
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
        onConfirm={() => itemToRemove && removeNow(itemToRemove)}
      />
      <ConfirmDialog
        open={isDeleting}
        title={t("menus.deleteTitle", { name: settings.name })}
        message={t("menus.deleteMessage")}
        confirmLabel={t("menus.delete")}
        cancelLabel={t("common.cancel")}
        isDestructive
        onCancel={() => setIsDeleting(false)}
        onConfirm={() => void confirmDelete()}
      />
      {isEditingSettings && (
        <MenuSettingsSheet
          title={t("menus.settings")}
          submitLabel={t("common.done")}
          initialName={settings.name}
          initialMaxDepth={settings.maxDepth}
          onSubmit={(name, _handle, maxDepth) => saveSettings(name, maxDepth)}
          onClose={() => setIsEditingSettings(false)}
        />
      )}
      <ConfirmDialog
        open={leaveWarning.isAsking}
        title={t("editor.leaveTitle")}
        message={t("menus.leaveMessage")}
        confirmLabel={t("editor.leave")}
        cancelLabel={t("editor.stay")}
        isDestructive
        onCancel={leaveWarning.stay}
        onConfirm={leaveWarning.leave}
      />
    </>
  );
}
