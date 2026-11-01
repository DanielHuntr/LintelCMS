import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Link } from "@tanstack/react-router";
import {
  ChevronDown,
  ChevronUp,
  CornerDownRight,
  GripVertical,
  ListIndentDecrease,
  ListIndentIncrease,
  type LucideIcon,
  SquareArrowOutUpRight,
} from "lucide-react";
import { classNames } from "../design/classNames.js";
import { t } from "../i18n/strings.js";
import type { ViewPageTarget } from "./viewPage.js";
import { ViewPageLink } from "./ViewPageLink.js";
import type { EntrySummary } from "./content.types.js";
import { EntryStatusBadge } from "./EntryStatusBadge.js";
import { formatDateTime, formatRelativeTime } from "./relativeTime.js";

/** How far each level of pages is indented; a drag this far sideways changes the level. */
export const INDENT_PIXELS = 20;

/** A change of parent offered as a button, with the label saying where the page goes. */
interface ParentMove {
  label: string;
  onSelect: () => void;
}

interface EntryRowProps {
  collectionHandle: string;
  entry: EntrySummary;
  /** How far to indent: pages nested under other pages. */
  depth: number;
  now: number;
  /**
   * Pages show sideways drags as a change of indent rather than following the pointer,
   * so the row stays in its column while the drop depth is shown.
   */
  lockHorizontalMovement?: boolean;
  /** Undefined when the list can't be reordered right now. */
  reorder?: {
    canMoveUp: boolean;
    canMoveDown: boolean;
    onMove: (direction: -1 | 1) => void;
    /** Pages only: under the sibling above, and out of the parent. */
    nest?: ParentMove;
    unnest?: ParentMove;
  };
  /** Where the live page is, for published entries. */
  viewPage?: ViewPageTarget;
}

/** One entry in the list: its title, status and who changed it last, and when. */
export function EntryRow({
  collectionHandle,
  entry,
  depth,
  now,
  lockHorizontalMovement = false,
  reorder,
  viewPage,
}: EntryRowProps) {
  const { setNodeRef, transform, transition, isDragging, listeners } = useSortable({
    id: entry.id,
    disabled: !reorder,
  });
  const title = entry.title || t("entries.untitled");

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(
          transform && lockHorizontalMovement ? { ...transform, x: 0 } : transform,
        ),
        transition: transition,
      }}
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
          className="flex h-full cursor-grab touch-none items-center self-stretch ps-2 text-label-tertiary opacity-0 transition-opacity duration-150 group-hover:opacity-100 active:cursor-grabbing"
        >
          <GripVertical strokeWidth={1.75} className="size-4" />
        </span>
      )}

      <Link
        to="/content/$collection/$entryId"
        params={{ collection: collectionHandle, entryId: entry.id }}
        style={{
          paddingLeft: `calc(${reorder ? "0.5rem" : "1.25rem"} + ${depth * INDENT_PIXELS}px)`,
        }}
        className="flex min-w-0 flex-1 items-center gap-3 py-3 pe-3 transition-colors duration-150 ease-standard hover:bg-fill/50 focus-visible:focus-ring-inset"
      >
        {depth > 0 && (
          <CornerDownRight
            aria-hidden="true"
            strokeWidth={1.75}
            className="-ms-1 size-4 shrink-0 self-start mt-0.5 text-label-tertiary"
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
        {(entry.columns ?? []).length > 0 && (
          <dl className="hidden max-w-[45%] shrink items-center gap-4 lg:flex">
            {(entry.columns ?? []).map((column) => (
              <div key={column.handle} className="flex min-w-0 max-w-48 flex-col">
                <dt className="truncate text-caption text-label-tertiary">{column.label}</dt>
                <dd className="truncate text-footnote text-label">{columnText(column.value)}</dd>
              </div>
            ))}
          </dl>
        )}
        <EntryStatusBadge status={entry.status} />
      </Link>

      {viewPage ? (
        <ViewPageLink
          target={viewPage}
          label={t("entries.viewPage", { title })}
          className="me-2 flex size-8 shrink-0 items-center justify-center rounded-control text-label-secondary transition-colors duration-150 ease-standard hover:bg-fill hover:text-accent focus-visible:focus-ring"
        >
          <SquareArrowOutUpRight aria-hidden="true" strokeWidth={1.75} className="size-4" />
        </ViewPageLink>
      ) : (
        // The same space on every row, so the status badges line up.
        <span aria-hidden="true" className="me-2 size-8 shrink-0" />
      )}

      {reorder && (
        <span className="flex shrink-0 items-center gap-0.5 pe-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
          {reorder.unnest && <ParentButton move={reorder.unnest} icon={ListIndentDecrease} />}
          {reorder.nest && <ParentButton move={reorder.nest} icon={ListIndentIncrease} />}
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

/** A column's value as short text: lists joined, switches as Yes or No, nothing as a dash. */
export function columnText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "–";
  if (typeof value === "boolean") return value ? t("entries.column.yes") : t("entries.column.no");
  if (Array.isArray(value)) return value.map((item) => columnText(item)).join(", ");
  if (typeof value === "object") return "…";
  return String(value);
}

function ParentButton({ move, icon: Icon }: { move: ParentMove; icon: LucideIcon }) {
  return (
    <button
      type="button"
      aria-label={move.label}
      title={move.label}
      onClick={(event) => {
        // This button may not exist once the page has moved, so keep focus on its row.
        const row = event.currentTarget.closest("li");
        move.onSelect();
        requestAnimationFrame(() => row?.querySelector<HTMLElement>("a")?.focus());
      }}
      className="flex size-7 items-center justify-center rounded-control text-label-secondary transition-colors duration-150 ease-standard hover:bg-fill hover:text-label focus-visible:focus-ring"
    >
      <Icon aria-hidden="true" strokeWidth={2} className="size-4" />
    </button>
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
