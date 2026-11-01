import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronUp, CornerDownRight, GripVertical } from "lucide-react";
import { classNames } from "../design/classNames.js";
import { t } from "../i18n/strings.js";
import type { EntrySummary } from "./content.types.js";
import { EntryStatusBadge } from "./EntryStatusBadge.js";
import { formatDateTime, formatRelativeTime } from "./relativeTime.js";

interface EntryRowProps {
  collectionHandle: string;
  entry: EntrySummary;
  /** How far to indent: pages nested under other pages. */
  depth: number;
  now: number;
  /** Undefined when the list can't be reordered right now. */
  reorder?: {
    canMoveUp: boolean;
    canMoveDown: boolean;
    onMove: (direction: -1 | 1) => void;
  };
}

/** One entry in the list: its title, status and who changed it last, and when. */
export function EntryRow({ collectionHandle, entry, depth, now, reorder }: EntryRowProps) {
  const { setNodeRef, transform, transition, isDragging, listeners } = useSortable({
    id: entry.id,
    disabled: !reorder,
  });
  const title = entry.title || t("entries.untitled");

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition: transition }}
      className={classNames(
        "group relative flex items-center bg-surface [&+&]:hairline-top",
        isDragging && "z-10 rounded-control shadow-float",
      )}
    >
      {reorder && (
        // Dragging is for pointers; keyboard and screen reader users get the move buttons instead.
        <span
          aria-hidden="true"
          {...listeners}
          className="flex h-full cursor-grab touch-none items-center self-stretch pl-2 text-label-tertiary opacity-0 transition-opacity duration-150 group-hover:opacity-100 active:cursor-grabbing"
        >
          <GripVertical strokeWidth={1.75} className="size-4" />
        </span>
      )}

      <Link
        to="/content/$collection/$entryId"
        params={{ collection: collectionHandle, entryId: entry.id }}
        style={{ paddingLeft: `calc(${reorder ? "0.5rem" : "1.25rem"} + ${depth * 1.25}rem)` }}
        className="flex min-w-0 flex-1 items-center gap-3 py-3 pr-3 transition-colors duration-150 ease-standard hover:bg-fill/50 focus-visible:focus-ring-inset"
      >
        {depth > 0 && (
          <CornerDownRight
            aria-hidden="true"
            strokeWidth={1.75}
            className="-ml-1 size-4 shrink-0 self-start mt-0.5 text-label-tertiary"
          />
        )}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-body font-medium text-label">{title}</span>
          <span className="truncate text-footnote text-label-secondary">
            <time dateTime={entry.updatedAt} title={formatDateTime(entry.updatedAt)}>
              {t("entries.updated", { time: formatRelativeTime(entry.updatedAt, now) })}
            </time>
            {entry.updatedBy && ` ${t("entries.updatedBy", { name: entry.updatedBy.name })}`}
          </span>
        </span>
        <EntryStatusBadge status={entry.status} />
      </Link>

      {reorder && (
        <span className="flex shrink-0 items-center gap-0.5 pr-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
          <MoveButton
            label={t("entries.moveUp", { title })}
            icon="up"
            disabled={!reorder.canMoveUp}
            onClick={() => reorder.onMove(-1)}
          />
          <MoveButton
            label={t("entries.moveDown", { title })}
            icon="down"
            disabled={!reorder.canMoveDown}
            onClick={() => reorder.onMove(1)}
          />
        </span>
      )}
    </li>
  );
}

function MoveButton({
  label,
  icon,
  disabled,
  onClick,
}: {
  label: string;
  icon: "up" | "down";
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = icon === "up" ? ChevronUp : ChevronDown;
  return (
    // aria-disabled rather than disabled: moving a page to the top must not drop the focus.
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
      className="flex size-7 items-center justify-center rounded-control text-label-secondary transition-colors duration-150 ease-standard hover:bg-fill hover:text-label focus-visible:focus-ring aria-disabled:pointer-events-none aria-disabled:opacity-30"
    >
      <Icon aria-hidden="true" strokeWidth={2} className="size-4" />
    </button>
  );
}
