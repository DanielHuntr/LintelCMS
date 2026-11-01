import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  ChevronUp,
  CornerDownRight,
  ExternalLink,
  FileText,
  GripVertical,
  IndentDecrease,
  IndentIncrease,
  Link2,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import { classNames } from "../design/classNames.js";
import { t } from "../i18n/strings.js";
import type { FlatMenuItem } from "./menuTree.js";
import type { LinkedEntry } from "./menus.types.js";

interface MenuItemRowProps {
  item: FlatMenuItem;
  linkedEntry: LinkedEntry | undefined;
  problem: string | undefined;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canIndent: boolean;
  canOutdent: boolean;
  onMove: (direction: -1 | 1) => void;
  onIndent: () => void;
  onOutdent: () => void;
  onEdit: () => void;
  onRemove: () => void;
}

/** The label people will see in a menu item: its own, or the linked page's title. */
export function menuItemLabel(item: FlatMenuItem, linkedEntry: LinkedEntry | undefined): string {
  if (item.label) return item.label;
  if (item.entryId) return linkedEntry?.title || t("menus.item.missingPage");
  return t("menus.item.unlabelled");
}

/** One item of the menu, indented by its level, with buttons for every move a drag can make. */
export function MenuItemRow({
  item,
  linkedEntry,
  problem,
  canMoveUp,
  canMoveDown,
  canIndent,
  canOutdent,
  onMove,
  onIndent,
  onOutdent,
  onEdit,
  onRemove,
}: MenuItemRowProps) {
  const { setNodeRef, transform, transition, isDragging, listeners } = useSortable({ id: item.id });
  const label = menuItemLabel(item, linkedEntry);
  const isMissing = item.entryId !== null && linkedEntry === undefined;
  const destination = item.entryId
    ? isMissing
      ? t("menus.item.missingPageHint")
      : t("menus.item.linksToPage")
    : (item.url ?? "");
  const Icon = item.entryId ? FileText : Link2;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={classNames(
        "group relative flex items-center bg-surface [&+&]:hairline-top",
        isDragging && "z-10 rounded-control shadow-float",
      )}
    >
      <span
        aria-hidden="true"
        {...listeners}
        className="flex cursor-grab touch-none items-center self-stretch ps-2 text-label-tertiary opacity-0 group-hover:opacity-100 active:cursor-grabbing"
      >
        <GripVertical strokeWidth={1.75} className="size-4" />
      </span>
      <button
        type="button"
        onClick={onEdit}
        aria-label={t("menus.item.edit", { label })}
        style={{ paddingLeft: `${0.5 + item.depth * 1.75}rem` }}
        className="flex min-w-0 flex-1 items-center gap-3 py-3 pe-3 text-start transition-colors duration-150 ease-standard hover:bg-fill/50 focus-visible:focus-ring-inset"
      >
        {item.depth > 0 && (
          <CornerDownRight
            aria-hidden="true"
            strokeWidth={1.75}
            className="-ms-1 size-4 shrink-0 text-label-tertiary"
          />
        )}
        <span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-fill text-label-secondary">
          <Icon aria-hidden="true" strokeWidth={1.75} className="size-4" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-body font-medium text-label">{label}</span>
          <span
            className={classNames(
              "truncate text-footnote",
              problem || isMissing ? "text-danger" : "text-label-secondary",
            )}
          >
            {problem ?? destination}
          </span>
        </span>
        {item.newTab && (
          <ExternalLink
            aria-label={t("menus.item.opensNewTab")}
            strokeWidth={1.75}
            className="size-4 shrink-0 text-label-tertiary"
          />
        )}
      </button>
      <span className="flex shrink-0 items-center gap-0.5 pe-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
        <RowButton
          label={t("menus.item.moveUp", { label })}
          disabled={!canMoveUp}
          onClick={() => onMove(-1)}
        >
          <ChevronUp aria-hidden="true" strokeWidth={2} className="size-4" />
        </RowButton>
        <RowButton
          label={t("menus.item.moveDown", { label })}
          disabled={!canMoveDown}
          onClick={() => onMove(1)}
        >
          <ChevronDown aria-hidden="true" strokeWidth={2} className="size-4" />
        </RowButton>
        <RowButton
          label={t("menus.item.outdent", { label })}
          disabled={!canOutdent}
          onClick={onOutdent}
        >
          <IndentDecrease aria-hidden="true" strokeWidth={1.75} className="size-4" />
        </RowButton>
        <RowButton
          label={t("menus.item.indent", { label })}
          disabled={!canIndent}
          onClick={onIndent}
        >
          <IndentIncrease aria-hidden="true" strokeWidth={1.75} className="size-4" />
        </RowButton>
        <RowButton
          label={t("menus.item.removeNamed", { label })}
          disabled={false}
          onClick={onRemove}
          tone="danger"
        >
          <Trash2 aria-hidden="true" strokeWidth={1.75} className="size-4" />
        </RowButton>
      </span>
    </li>
  );
}

function RowButton({
  label,
  disabled,
  onClick,
  tone,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  tone?: "danger";
  children: ReactNode;
}) {
  return (
    // aria-disabled keeps focus on the button when an item reaches the end of what it can do.
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
      className={classNames(
        "flex size-7 items-center justify-center rounded-control text-label-secondary transition-colors duration-150 ease-standard hover:bg-fill focus-visible:focus-ring aria-disabled:pointer-events-none aria-disabled:opacity-30",
        tone === "danger" ? "hover:text-danger" : "hover:text-label",
      )}
    >
      {children}
    </button>
  );
}
