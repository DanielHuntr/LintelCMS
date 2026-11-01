import type { LucideIcon } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { classNames } from "../design/classNames.js";

export interface ActionItem {
  key: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  tone?: "default" | "danger";
}

interface TreeActionsMenuProps {
  label: string;
  items: readonly ActionItem[];
  /** Where it opens: under the "…" button, or where the pointer was for a right-click. */
  position: { x: number; y: number };
  onClose: () => void;
}

const EDGE_GAP = 8;

/**
 * The actions for a row of the tree, as a menu floating over the page. It follows the ARIA
 * menu pattern like `design/Menu.tsx` (arrow keys, Home and End, Escape), and can open
 * anywhere, so a right-click shows it at the pointer. It stays inside the window.
 */
export function TreeActionsMenu({ label, items, position, onClose }: TreeActionsMenuProps) {
  const menu = useRef<HTMLDivElement>(null);
  const itemElements = useRef<Array<HTMLButtonElement | null>>([]);
  const [placed, setPlaced] = useState(position);

  useLayoutEffect(() => {
    const element = menu.current;
    if (!element) return;
    const { width, height } = element.getBoundingClientRect();
    setPlaced({
      x: Math.max(EDGE_GAP, Math.min(position.x, window.innerWidth - width - EDGE_GAP)),
      y: Math.max(EDGE_GAP, Math.min(position.y, window.innerHeight - height - EDGE_GAP)),
    });
  }, [position]);

  useEffect(() => {
    itemElements.current[0]?.focus();
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!menu.current?.contains(event.target as Node)) onClose();
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const focused = itemElements.current.findIndex((item) => item === document.activeElement);
    const last = items.length - 1;
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
    if (target === undefined) return;
    event.preventDefault();
    itemElements.current[target]?.focus();
  }

  return createPortal(
    <div
      ref={menu}
      role="menu"
      aria-label={label}
      onKeyDown={handleKeyDown}
      onContextMenu={(event) => event.preventDefault()}
      style={{ left: placed.x, top: placed.y }}
      className={classNames(
        "fixed z-40 flex min-w-52 flex-col rounded-card bg-surface-raised p-1.5 shadow-float hairline-ring",
        "motion-safe:transition-[opacity,scale] motion-safe:duration-150 motion-safe:starting:scale-95 starting:opacity-0",
      )}
    >
      {items.map((item, index) => (
        <button
          key={item.key}
          ref={(element) => {
            itemElements.current[index] = element;
          }}
          type="button"
          role="menuitem"
          tabIndex={-1}
          onClick={() => {
            // Closing first lets focus return to the row before a dialog takes it.
            onClose();
            item.onSelect();
          }}
          className={classNames(
            "flex h-8 items-center gap-2.5 rounded-[6px] px-2.5 text-left text-body outline-none",
            "hover:bg-fill focus:bg-accent-fill focus:text-on-accent",
            item.tone === "danger" ? "text-danger" : "text-label",
          )}
        >
          <item.icon aria-hidden="true" strokeWidth={1.75} className="size-4 shrink-0" />
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}
