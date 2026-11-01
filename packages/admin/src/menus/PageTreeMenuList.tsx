import { CornerDownRight, EyeOff, House, Pencil, Undo2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "../design/Button.js";
import { classNames } from "../design/classNames.js";
import { Dialog } from "../design/Dialog.js";
import { EmptyState } from "../design/EmptyState.js";
import { TextField } from "../design/TextField.js";
import { Toggle } from "../design/Toggle.js";
import { t } from "../i18n/strings.js";
import { menuItemLabel } from "./MenuItemRow.js";
import type { FlatMenuItem } from "./menuTree.js";
import type { MenuDraft } from "./useMenuDraft.js";

/**
 * A menu that follows the page tree: the pages it shows, in the tree's order, each of which
 * can be hidden from the menu or given a label of its own there; then the hidden ones, to
 * show again. Order and nesting come from the tree itself.
 */
/** The items a menu that follows the tree shows now, with labels of their own applied. */
export function pageTreePreviewItems(draft: MenuDraft): FlatMenuItem[] {
  return withoutHidden(draft.items, new Set(draft.pageTree.hiddenEntryIds)).map((item) => ({
    ...item,
    label: draft.pageTree.labels[item.entryId ?? ""] ?? "",
  }));
}

export function PageTreeMenuList({
  draft,
  compact = false,
}: {
  draft: MenuDraft;
  compact?: boolean;
}) {
  const { pageTree, setPageTree, linkedEntries, items } = draft;
  const [renaming, setRenaming] = useState<FlatMenuItem | null>(null);
  const hidden = new Set(pageTree.hiddenEntryIds);
  // Pages hidden since the last save are still in `items` until it is saved, so leave them out.
  const shown = withoutHidden(items, hidden);
  const labelOf = (item: FlatMenuItem) =>
    pageTree.labels[item.entryId ?? ""] ||
    menuItemLabel({ ...item, label: "" }, linkedEntries[item.entryId ?? ""]);

  function hide(entryId: string) {
    setPageTree({ ...pageTree, hiddenEntryIds: [...hidden, entryId] });
  }

  function show(entryId: string) {
    setPageTree({
      ...pageTree,
      hiddenEntryIds: pageTree.hiddenEntryIds.filter((id) => id !== entryId),
    });
  }

  function rename(entryId: string, label: string) {
    const labels = { ...pageTree.labels };
    if (label.trim() === "") delete labels[entryId];
    else labels[entryId] = label.trim();
    setPageTree({ ...pageTree, labels });
  }

  return (
    <div className="flex flex-col gap-4">
      <Toggle
        label={t("menus.tree.includeHome")}
        checked={pageTree.includeHome}
        onCheckedChange={(includeHome) => setPageTree({ ...pageTree, includeHome })}
      />
      {shown.length === 0 ? (
        <div className="rounded-card bg-surface">
          <EmptyState
            size="card"
            icon={House}
            title={t("menus.tree.empty")}
            description={t("menus.tree.emptyDescription")}
          />
        </div>
      ) : (
        <ul aria-label={t("menus.items")} className="overflow-hidden rounded-card bg-surface">
          {shown.map((item) => {
            const label = labelOf(item);
            const entryId = item.entryId ?? "";
            return (
              <li
                key={item.id}
                style={{ paddingInlineStart: `${0.75 + item.depth * (compact ? 1 : 1.75)}rem` }}
                className={classNames(
                  "flex items-center gap-2 pe-2 [&+&]:hairline-top",
                  compact ? "py-1.5" : "py-2.5",
                )}
              >
                {item.depth > 0 && (
                  <CornerDownRight
                    aria-hidden="true"
                    strokeWidth={1.75}
                    className="size-4 shrink-0 text-label-tertiary"
                  />
                )}
                <span className="min-w-0 flex-1 truncate text-body text-label">{label}</span>
                <IconAction
                  label={t("menus.tree.rename", { label })}
                  onClick={() => setRenaming(item)}
                >
                  <Pencil aria-hidden="true" strokeWidth={1.75} className="size-4" />
                </IconAction>
                <IconAction label={t("menus.tree.hide", { label })} onClick={() => hide(entryId)}>
                  <EyeOff aria-hidden="true" strokeWidth={1.75} className="size-4" />
                </IconAction>
              </li>
            );
          })}
        </ul>
      )}
      <p className="px-1 text-caption text-label-secondary">
        {t("menus.tree.levelsNote", { count: draft.maxDepth })}
      </p>
      {pageTree.hiddenEntryIds.length > 0 && (
        <section aria-labelledby="menu-hidden-pages" className="flex flex-col gap-1.5">
          <h3 id="menu-hidden-pages" className="px-1 text-footnote font-semibold text-label">
            {t("menus.tree.hidden")}
          </h3>
          <ul className="flex flex-wrap gap-2">
            {pageTree.hiddenEntryIds.map((entryId) => {
              const label = linkedEntries[entryId]?.title || t("menus.item.missingPage");
              return (
                <li key={entryId}>
                  <Button
                    size="small"
                    variant="tinted"
                    icon={<Undo2 aria-hidden="true" />}
                    onClick={() => show(entryId)}
                  >
                    {t("menus.tree.show", { label })}
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {renaming && (
        <RenameDialog
          initial={pageTree.labels[renaming.entryId ?? ""] ?? ""}
          placeholder={linkedEntries[renaming.entryId ?? ""]?.title ?? ""}
          onSave={(label) => {
            rename(renaming.entryId ?? "", label);
            setRenaming(null);
          }}
          onClose={() => setRenaming(null)}
        />
      )}
    </div>
  );
}

function withoutHidden(
  items: readonly FlatMenuItem[],
  hidden: ReadonlySet<string>,
): FlatMenuItem[] {
  const kept: FlatMenuItem[] = [];
  let skippingBelow: number | null = null;
  for (const item of items) {
    if (skippingBelow !== null && item.depth > skippingBelow) continue;
    skippingBelow = null;
    if (item.entryId && hidden.has(item.entryId)) {
      skippingBelow = item.depth;
      continue;
    }
    kept.push(item);
  }
  return kept;
}

function IconAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-7 shrink-0 items-center justify-center rounded-control text-label-secondary hover:bg-fill hover:text-label focus-visible:focus-ring"
    >
      {children}
    </button>
  );
}

function RenameDialog({
  initial,
  placeholder,
  onSave,
  onClose,
}: {
  initial: string;
  placeholder: string;
  onSave: (label: string) => void;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(initial);
  return (
    <Dialog
      open
      size="alert"
      onClose={onClose}
      title={t("menus.tree.renameTitle")}
      footer={
        <>
          <Button variant="tinted" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => onSave(label)}>{t("common.done")}</Button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave(label);
        }}
      >
        <TextField
          label={t("pageMenu.label")}
          hint={t("pageMenu.labelHint")}
          placeholder={placeholder}
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          data-autofocus=""
        />
      </form>
    </Dialog>
  );
}
