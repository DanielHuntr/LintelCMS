import { Check, ChevronRight, Ellipsis, type LucideIcon } from "lucide-react";
import {
  useState,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { classNames } from "../design/classNames.js";
import { t } from "../i18n/strings.js";
import { StatusDot } from "./StatusDot.js";
import { TreeActionsMenu, type ActionItem } from "./TreeActionsMenu.js";
import type { NodeState } from "./treeActions.js";
import type { SelectGesture } from "./treeSelection.js";
import type { DropPosition, TreeKey } from "./treeState.js";

/** Pointer and drop handlers for rows that can be dragged or dropped on. */
export interface RowDragHandlers {
  draggable: boolean;
  onDragStart?: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
  onDragOver?: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave?: () => void;
  onDrop?: (event: DragEvent<HTMLDivElement>) => void;
  /** Where a drop would land, drawn as a line above or below, or a ring around. */
  dropIndicator?: DropPosition;
}

interface TreeRowProps {
  treeKey: TreeKey;
  parentKey?: TreeKey;
  /** 0 for a section at the top. */
  depth: number;
  label: string;
  icon: LucideIcon;
  isSelected: boolean;
  isTabStop: boolean;
  onOpen: () => void;
  isExpandable: boolean;
  isExpanded: boolean;
  onToggle?: () => void;
  state?: NodeState;
  /** A count shown at the end, for folders whose items open as a list. */
  count?: { value: number; description: string };
  actions?: readonly ActionItem[];
  drag?: RowDragHandlers;
  onFocus: () => void;
  /**
   * For entries: picks the row along with others (Ctrl/⌘-click or Space toggles it,
   * Shift-click picks the run), and Shift and an arrow key extends the pick to the next row.
   */
  selecting?: {
    isPicked: boolean;
    /** Some row is picked, so the tree is choosing several rather than opening one. */
    isActive: boolean;
    onSelect: (gesture: SelectGesture) => void;
    onExtendTo: (key: TreeKey) => void;
  };
  /** The branch under the row, when it is expanded. */
  children?: ReactNode;
}

const INDENT_PX = 14;

/**
 * One row of the tree, following the ARIA tree pattern: the arrow keys move between rows and
 * open or close branches, Enter opens the row in the workspace, and Shift+F10 (or the menu
 * key) opens its actions, as a right-click or the "…" button does.
 */
export function TreeRow({
  treeKey,
  parentKey,
  depth,
  label,
  icon: Icon,
  isSelected,
  isTabStop,
  onOpen,
  isExpandable,
  isExpanded,
  onToggle,
  state,
  count,
  actions,
  drag,
  onFocus,
  selecting,
  children,
}: TreeRowProps) {
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);
  const hasActions = actions !== undefined && actions.length > 0;
  const menuLabel = t("tree.actions", { title: label });

  function handleKeyDown(event: KeyboardEvent<HTMLLIElement>) {
    if (event.target !== event.currentTarget) return;
    const row = event.currentTarget;
    if (selecting && event.key === " ") {
      event.preventDefault();
      selecting.onSelect("toggle");
      return;
    }
    if (selecting && event.shiftKey && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      if (!selecting.isPicked) selecting.onSelect("toggle");
      moveFocus(event.key, row, { isExpandable, isExpanded, parentKey, onToggle, onOpen });
      const focused = document.activeElement as HTMLElement | null;
      if (focused?.dataset.key && focused !== row) selecting.onExtendTo(focused.dataset.key);
      return;
    }
    if ((event.shiftKey && event.key === "F10") || event.key === "ContextMenu") {
      if (!hasActions) return;
      event.preventDefault();
      const box = row.firstElementChild?.getBoundingClientRect() ?? row.getBoundingClientRect();
      setMenuAt({ x: box.left + 24, y: box.bottom });
      return;
    }
    const handled = moveFocus(event.key, row, {
      isExpandable,
      isExpanded,
      parentKey,
      onToggle,
      onOpen,
    });
    if (handled) event.preventDefault();
  }

  function openMenuAtPointer(event: MouseEvent) {
    if (!hasActions) return;
    event.preventDefault();
    setMenuAt({ x: event.clientX, y: event.clientY });
  }

  return (
    <li
      role="treeitem"
      aria-level={depth + 1}
      aria-expanded={isExpandable ? isExpanded : undefined}
      aria-selected={selecting?.isActive ? selecting.isPicked : isSelected}
      aria-label={[
        label,
        state ? t(`tree.status.${stateLabel(state)}`) : undefined,
        selecting?.isPicked ? t("tree.selection.selectedState") : undefined,
      ]
        .filter(Boolean)
        .join(", ")}
      aria-keyshortcuts={hasActions ? "Shift+F10" : undefined}
      tabIndex={isTabStop ? 0 : -1}
      data-tree-row=""
      data-key={treeKey}
      onFocus={(event) => {
        if (event.target === event.currentTarget) onFocus();
      }}
      onKeyDown={handleKeyDown}
      className="outline-none [&:focus-visible>div]:focus-ring"
    >
      <div
        draggable={drag?.draggable}
        onDragStart={drag?.onDragStart}
        onDragEnd={drag?.onDragEnd}
        onDragOver={drag?.onDragOver}
        onDragLeave={drag?.onDragLeave}
        onDrop={drag?.onDrop}
        onContextMenu={openMenuAtPointer}
        onClick={(event) => {
          if (selecting && (event.metaKey || event.ctrlKey || event.shiftKey)) {
            event.preventDefault();
            selecting.onSelect(event.shiftKey ? "range" : "toggle");
            return;
          }
          onOpen();
        }}
        style={{ paddingLeft: 6 + depth * INDENT_PX }}
        className={classNames(
          "group relative flex h-8 cursor-default items-center gap-1.5 rounded-control pe-1 text-body select-none",
          "transition-colors duration-150 ease-standard",
          selecting?.isPicked
            ? "bg-accent/18 font-medium text-label ring-1 ring-accent/50 ring-inset"
            : isSelected && !selecting?.isActive
              ? "bg-accent/12 font-medium text-accent"
              : "text-label hover:bg-fill",
          drag?.dropIndicator === "inside" && "ring-2 ring-accent ring-inset",
          drag?.dropIndicator === "before" &&
            "before:absolute before:inset-x-1 before:-top-px before:h-0.5 before:rounded-full before:bg-accent",
          drag?.dropIndicator === "after" &&
            "after:absolute after:inset-x-1 after:-bottom-px after:h-0.5 after:rounded-full after:bg-accent",
        )}
      >
        <span
          aria-hidden="true"
          onClick={(event) => {
            event.stopPropagation();
            onToggle?.();
          }}
          className={classNames(
            "flex size-5 shrink-0 items-center justify-center rounded-[5px] text-label-tertiary",
            isExpandable ? "hover:bg-fill-strong hover:text-label" : "invisible",
          )}
        >
          <ChevronRight
            strokeWidth={2}
            className={classNames(
              "size-3.5 motion-safe:transition-transform motion-safe:duration-150",
              isExpanded && "rotate-90",
            )}
          />
        </span>
        {selecting?.isPicked ? (
          <span
            aria-hidden="true"
            className="flex size-4 shrink-0 items-center justify-center rounded-full bg-accent-fill text-on-accent"
          >
            <Check strokeWidth={3} className="size-2.5" />
          </span>
        ) : (
          <Icon
            aria-hidden="true"
            strokeWidth={1.75}
            className={classNames(
              "size-4 shrink-0",
              isSelected ? "text-accent" : "text-label-secondary",
            )}
          />
        )}
        <span className="min-w-0 flex-1 truncate" title={label}>
          {label}
        </span>
        {count && (
          <span
            title={count.description}
            className="shrink-0 rounded-full bg-fill px-1.5 text-caption text-label-secondary tabular-nums"
          >
            {count.value}
          </span>
        )}
        {state && <StatusDot state={state} />}
        {hasActions && (
          <button
            type="button"
            tabIndex={-1}
            aria-label={menuLabel}
            title={menuLabel}
            onClick={(event) => {
              event.stopPropagation();
              const box = event.currentTarget.getBoundingClientRect();
              setMenuAt({ x: box.left, y: box.bottom + 4 });
            }}
            className={classNames(
              "flex size-6 shrink-0 items-center justify-center rounded-[6px] text-label-secondary hover:bg-fill-strong hover:text-label",
              menuAt ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            )}
          >
            <Ellipsis aria-hidden="true" strokeWidth={2} className="size-4" />
          </button>
        )}
      </div>
      {children}
      {menuAt && actions && (
        <TreeActionsMenu
          label={menuLabel}
          items={actions}
          position={menuAt}
          onClose={() => setMenuAt(null)}
        />
      )}
    </li>
  );
}

function stateLabel(state: NodeState): "published" | "draft" | "scheduled" | "changed" {
  return state;
}

/** The rows on screen, in order: collapsed branches aren't drawn, so these are the visible ones. */
function visibleRows(from: HTMLElement): HTMLElement[] {
  const tree = from.closest('[role="tree"]');
  return tree ? [...tree.querySelectorAll<HTMLElement>("[data-tree-row]")] : [];
}

function moveFocus(
  key: string,
  row: HTMLElement,
  options: {
    isExpandable: boolean;
    isExpanded: boolean;
    parentKey?: TreeKey;
    onToggle?: () => void;
    onOpen: () => void;
  },
): boolean {
  const rows = visibleRows(row);
  const index = rows.indexOf(row);
  const focusAt = (target: number) => rows[Math.max(0, Math.min(rows.length - 1, target))]?.focus();
  switch (key) {
    case "ArrowDown":
      focusAt(index + 1);
      return true;
    case "ArrowUp":
      focusAt(index - 1);
      return true;
    case "Home":
      focusAt(0);
      return true;
    case "End":
      focusAt(rows.length - 1);
      return true;
    case "ArrowRight":
      if (options.isExpandable && !options.isExpanded) options.onToggle?.();
      else if (options.isExpanded) focusAt(index + 1);
      return true;
    case "ArrowLeft":
      if (options.isExpanded) options.onToggle?.();
      else if (options.parentKey) {
        rows.find((candidate) => candidate.dataset.key === options.parentKey)?.focus();
      }
      return true;
    case "Enter":
      options.onOpen();
      return true;
    default:
      return false;
  }
}
