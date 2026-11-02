import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Ellipsis, FilePlus2, Link2, ListTree, Settings2, Trash2 } from "lucide-react";
import { useState } from "react";
import { describeError } from "../api/describeError.js";
import { useLeaveWarning } from "../content/useLeaveWarning.js";
import { useContentModelEditable } from "../content-model-sync/contentModelSync.queries.js";
import { BackLink } from "../design/BackLink.js";
import { Button } from "../design/Button.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { EmptyState } from "../design/EmptyState.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { Menu as ActionsMenu } from "../design/Menu.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { AddPagesDialog } from "./AddPagesDialog.js";
import { MenuItemSheet } from "./MenuItemSheet.js";
import { MenuItemsList } from "./MenuItemsList.js";
import { MenuPreview } from "./MenuPreview.js";
import { MenuSettingsSheet } from "./MenuSettingsSheet.js";
import { type FlatMenuItem, removeItem } from "./menuTree.js";
import { deleteMenu, saveMenu } from "./menus.api.js";
import { menuKeys } from "./menus.queries.js";
import type { Menu, MenuSource } from "./menus.types.js";
import { PageTreeMenuList, pageTreePreviewItems } from "./PageTreeMenuList.js";
import { type MenuDraft, useMenuDraft } from "./useMenuDraft.js";

/**
 * A menu, made by hand or following the page tree. By hand: add pages (several at once, from
 * the tree) and links, drag them into order and to the right to make drop-downs, or use each
 * row's buttons. Following the tree: hide pages or rename them. A preview shows how it looks.
 * Changes are saved together with Save.
 */
export function MenuEditor({ menu }: { menu: Menu }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const canEdit = useCan("navigation:update");
  // The menu's name and levels are part of the content model; its items are content.
  const canChangeSettings = useContentModelEditable();
  const draft = useMenuDraft(menu);
  const [name, setName] = useState(menu.name);
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [switchingTo, setSwitchingTo] = useState<MenuSource | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const leaveWarning = useLeaveWarning(draft.isUnsaved);
  const followsTree = draft.source === "pageTree";

  async function saveSettings(nextName: string, maxDepth: number) {
    const updated = await saveMenu(menu.handle, { name: nextName, maxDepth });
    setName(updated.name);
    draft.adopt(updated);
    setIsEditingSettings(false);
  }

  async function confirmDelete() {
    try {
      await deleteMenu(menu.handle);
      await queryClient.invalidateQueries({ queryKey: menuKeys.menus() });
      await navigate({ to: "/content/navigation", ignoreBlocker: true });
    } catch (error) {
      setDeleteError(describeError(error));
      setIsDeleting(false);
    }
  }

  return (
    <>
      <BackLink to="/content/navigation">{t("menus.title")}</BackLink>
      <LargeTitle
        title={name}
        subtitle={t("menus.levels", { count: draft.maxDepth })}
        actions={
          canEdit && (
            <>
              {canChangeSettings && (
                <ActionsMenu
                  label={t("menus.moreActions", { name })}
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
                onClick={() => void draft.save()}
                disabled={draft.isSaving || !draft.isUnsaved}
              >
                {draft.isSaving ? t("builder.saving") : t("menus.save")}
              </Button>
            </>
          )
        }
      />

      {(draft.saveError || deleteError) && (
        <p
          role="alert"
          className="mb-6 rounded-card bg-danger/10 px-4 py-3 text-footnote text-label"
        >
          {draft.saveError ?? deleteError}
        </p>
      )}

      <div className="flex flex-col gap-6">
        {canEdit && (
          <div className="flex flex-col gap-1.5">
            <SegmentedControl<MenuSource>
              label={t("menus.source")}
              options={[
                { value: "items", label: t("menus.source.items") },
                { value: "pageTree", label: t("menus.source.pageTree") },
              ]}
              value={draft.source}
              onChange={(next) => next !== draft.source && setSwitchingTo(next)}
            />
            <p className="px-1 text-footnote text-label-secondary">
              {followsTree ? t("menus.source.pageTreeHint") : t("menus.source.itemsHint")}
            </p>
          </div>
        )}

        <MenuPreview
          items={followsTree ? pageTreePreviewItems(draft) : draft.items}
          linkedEntries={draft.linkedEntries}
        />

        {followsTree ? (
          <PageTreeMenuList draft={draft} />
        ) : (
          <HandMadeItems draft={draft} menuName={name} canEdit={canEdit} />
        )}
      </div>

      <ConfirmDialog
        open={switchingTo !== null}
        title={
          switchingTo === "pageTree"
            ? t("menus.source.toTreeTitle")
            : t("menus.source.toItemsTitle")
        }
        message={
          switchingTo === "pageTree"
            ? t("menus.source.toTreeMessage")
            : t("menus.source.toItemsMessage")
        }
        confirmLabel={
          switchingTo === "pageTree"
            ? t("menus.source.toTreeConfirm")
            : t("menus.source.toItemsConfirm")
        }
        cancelLabel={t("common.cancel")}
        isWorking={draft.isSaving}
        onCancel={() => setSwitchingTo(null)}
        onConfirm={() => {
          if (switchingTo) void draft.switchSource(switchingTo).then(() => setSwitchingTo(null));
        }}
      />
      <ConfirmDialog
        open={isDeleting}
        title={t("menus.deleteTitle", { name })}
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
          initialName={name}
          initialMaxDepth={draft.maxDepth}
          onSubmit={(nextName, _handle, maxDepth) => saveSettings(nextName, maxDepth)}
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

/**
 * The items of a hand-made menu with "Add pages" and "Add link", and the sheets they open.
 * Shared with the page builder's menu editor (`compact`).
 */
export function HandMadeItems({
  draft,
  menuName,
  canEdit,
  compact = false,
}: {
  draft: MenuDraft;
  menuName: string;
  canEdit: boolean;
  compact?: boolean;
}) {
  const [editing, setEditing] = useState<{ item: FlatMenuItem | null } | null>(null);
  const [isAddingPages, setIsAddingPages] = useState(false);
  const { items, change, linkedEntries } = draft;

  const addButtons = canEdit && (
    <div className="flex flex-wrap gap-2">
      <Button
        size={compact ? "small" : "medium"}
        icon={<FilePlus2 aria-hidden="true" />}
        onClick={() => setIsAddingPages(true)}
      >
        {t("menus.addPages")}
      </Button>
      <Button
        size={compact ? "small" : "medium"}
        variant="tinted"
        icon={<Link2 aria-hidden="true" />}
        onClick={() => setEditing({ item: null })}
      >
        {t("menus.addLink")}
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      {items.length === 0 ? (
        <div className="rounded-card bg-surface">
          <EmptyState
            size={compact ? "card" : "page"}
            icon={ListTree}
            title={t("menus.emptyItemsTitle")}
            description={t("menus.emptyItemsDescription")}
            action={addButtons}
          />
        </div>
      ) : (
        <>
          {addButtons}
          <MenuItemsList draft={draft} compact={compact} onEdit={(item) => setEditing({ item })} />
        </>
      )}

      {isAddingPages && (
        <AddPagesDialog
          menuName={menuName}
          linkedIds={new Set(items.flatMap((item) => (item.entryId ? [item.entryId] : [])))}
          onAdd={(pages) => {
            draft.addPages(pages);
            setIsAddingPages(false);
          }}
          onClose={() => setIsAddingPages(false)}
        />
      )}
      {editing && (
        <MenuItemSheet
          item={editing.item}
          linkedTitle={
            editing.item?.entryId ? linkedEntries[editing.item.entryId]?.title : undefined
          }
          onSave={(changed, picked) => {
            if (picked) {
              draft.setLinkedEntries((current) => ({
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
                  setEditing(null);
                  if (item) change(removeItem(items, item.id));
                }
              : undefined
          }
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
