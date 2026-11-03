import { ChevronRight, Ellipsis, type LucideIcon } from "lucide-react";
import {
  Fragment,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { classNames } from "../design/classNames.js";
import { t } from "../i18n/strings.js";
import type { MenuSection } from "./treeActions.js";

export interface ActionItem {
  key: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  tone?: "default" | "danger";
  /** Which group of the menu it belongs to; "more" folds away. Left out, it's one flat list. */
  section?: MenuSection;
}

interface TreeActionsMenuProps {
  label: string;
  items: readonly ActionItem[];
  /** Where it opens: under the "…" button, or where the pointer was for a right-click. */
  position: { x: number; y: number };
  onClose: () => void;
}

const EDGE_GAP = 8;
const MORE_KEY = "more";

/** What's in view and what folds under More. One lone item isn't worth a More row. */
export function menuRows(items: readonly ActionItem[]): {
  shown: readonly ActionItem[];
  folded: readonly ActionItem[];
} {
  const folded = items.filter((item) => item.section === "more");
  return folded.length > 1
    ? { shown: items.filter((item) => item.section !== "more"), folded }
    : { shown: items, folded: [] };
}

/**
 * The actions for a row of the tree, as a menu floating over the page, in groups with the
 * rarer ones folded under More. It follows the ARIA menu pattern like `design/Menu.tsx` (arrow
 * keys, Home and End, Escape), and can open anywhere, so a right-click shows it at the pointer.
 * More opens in place, which works the same with a finger; Right and Left open and close it.
 * The menu stays inside the window.
 */
export function TreeActionsMenu({ label, items, position, onClose }: TreeActionsMenuProps) {
  const menu = useRef<HTMLDivElement>(null);
  const [placed, setPlaced] = useState(position);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const { shown, folded } = menuRows(items);
  const beforeMore = shown.filter((item) => item.section !== "delete");
  const afterMore = shown.filter((item) => item.section === "delete");
  const keysInOrder = [
    ...beforeMore.map((item) => item.key),
    ...(folded.length > 0 ? [MORE_KEY] : []),
    ...(isMoreOpen ? folded.map((item) => item.key) : []),
    ...afterMore.map((item) => item.key),
  ];

  function focusRow(key: string | undefined) {
    if (!key) return;
    menu.current?.querySelector<HTMLElement>(`[data-menu-key="${key}"]`)?.focus();
  }

  useLayoutEffect(() => {
    const element = menu.current;
    if (!element) return;
    const { width, height } = element.getBoundingClientRect();
    setPlaced({
      x: Math.max(EDGE_GAP, Math.min(position.x, window.innerWidth - width - EDGE_GAP)),
      y: Math.max(EDGE_GAP, Math.min(position.y, window.innerHeight - height - EDGE_GAP)),
    });
  }, [position, isMoreOpen]);

  // Opening focuses the first item once; the callers' onClose may change on every render.
  const close = useEffectEvent(() => onClose());
  const focusFirst = useEffectEvent(() => focusRow(keysInOrder[0]));
  useEffect(() => {
    focusFirst();
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!menu.current?.contains(event.target as Node)) close();
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      window.removeEventListener("resize", close);
    };
  }, []);

  // Opening More moves into it, so the next arrow key is already among its items.
  const focusFirstFolded = useEffectEvent(() => focusRow(folded[0]?.key));
  useEffect(() => {
    if (isMoreOpen) focusFirstFolded();
  }, [isMoreOpen]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const focusedKey =
      document.activeElement instanceof HTMLElement
        ? document.activeElement.dataset.menuKey
        : undefined;
    const focused = focusedKey === undefined ? -1 : keysInOrder.indexOf(focusedKey);
    const last = keysInOrder.length - 1;
    const target = {
      ArrowDown: focused >= last ? 0 : focused + 1,
      ArrowUp: focused <= 0 ? last : focused - 1,
      Home: 0,
      End: last,
    }[event.key];
    if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowRight" && focusedKey === MORE_KEY && !isMoreOpen) {
      event.preventDefault();
      setIsMoreOpen(true);
      return;
    }
    const isInMore = focusedKey === MORE_KEY || folded.some((item) => item.key === focusedKey);
    if (event.key === "ArrowLeft" && isMoreOpen && isInMore) {
      event.preventDefault();
      setIsMoreOpen(false);
      focusRow(MORE_KEY);
      return;
    }
    if (target === undefined) return;
    event.preventDefault();
    focusRow(keysInOrder[target]);
  }

  const itemRow = (item: ActionItem, isIndented = false) => (
    <button
      key={item.key}
      data-menu-key={item.key}
      type="button"
      role="menuitem"
      tabIndex={-1}
      onClick={() => {
        // Closing first lets focus return to the row before a dialog takes it.
        onClose();
        item.onSelect();
      }}
      className={classNames(
        rowClasses,
        isIndented && "ps-5",
        item.tone === "danger" ? "text-danger" : "text-label",
      )}
    >
      <item.icon aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
      {item.label}
    </button>
  );

  return createPortal(
    <div
      ref={menu}
      role="menu"
      aria-label={label}
      onKeyDown={handleKeyDown}
      onContextMenu={(event) => event.preventDefault()}
      style={{ left: placed.x, top: placed.y }}
      className={classNames(
        "fixed z-40 flex max-h-[calc(100dvh-1rem)] min-w-52 flex-col overflow-y-auto rounded-card bg-surface-raised p-1.5 shadow-float hairline-ring",
        "motion-safe:transition-[opacity,scale] motion-safe:duration-150 motion-safe:starting:scale-95 starting:opacity-0",
      )}
    >
      {beforeMore.map((item, index) => (
        <Fragment key={item.key}>
          {index > 0 && item.section !== beforeMore[index - 1]?.section && <Separator />}
          {itemRow(item)}
        </Fragment>
      ))}
      {folded.length > 0 && (
        <>
          {beforeMore.length > 0 && <Separator />}
          <button
            data-menu-key={MORE_KEY}
            type="button"
            role="menuitem"
            tabIndex={-1}
            aria-expanded={isMoreOpen}
            onClick={() => setIsMoreOpen(!isMoreOpen)}
            className={classNames(rowClasses, "text-label")}
          >
            <Ellipsis aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
            <span className="flex-1">{t("tree.action.more")}</span>
            <ChevronRight
              aria-hidden="true"
              strokeWidth={2}
              className={classNames(
                "size-3.5 shrink-0 motion-safe:transition-transform motion-safe:duration-150",
                isMoreOpen && "rotate-90",
              )}
            />
          </button>
          {isMoreOpen && (
            <div role="group" aria-label={t("tree.action.more")} className="flex flex-col">
              {folded.map((item) => itemRow(item, true))}
            </div>
          )}
        </>
      )}
      {afterMore.length > 0 && (beforeMore.length > 0 || folded.length > 0) && <Separator />}
      {afterMore.map((item) => itemRow(item))}
    </div>,
    document.body,
  );
}

const rowClasses = classNames(
  "flex h-8 shrink-0 items-center gap-2.5 rounded-[6px] px-2.5 text-start text-body outline-none",
  "hover:bg-fill focus:bg-accent-fill focus:text-on-accent",
);

function Separator() {
  return <div role="separator" className="mx-2.5 my-1 h-px shrink-0 bg-separator" />;
}
