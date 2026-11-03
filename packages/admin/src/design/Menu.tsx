import type { LucideIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { classNames } from "./classNames.js";

export interface MenuItem {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  /** "danger" for items that delete things. */
  tone?: "default" | "danger";
}

interface MenuProps {
  /** The button's accessible name, e.g. "More actions". */
  label: string;
  /** What the button shows, usually an icon such as `<Ellipsis aria-hidden />`. */
  trigger: ReactNode;
  items: readonly MenuItem[];
  /** Replaces the square icon button's look, for a trigger with words such as a toolbar button. */
  triggerClassName?: string;
}

/**
 * A button that opens a short list of actions, like the "..." menu in macOS toolbars.
 * It follows the ARIA menu button pattern: arrow keys move between items, Escape closes the
 * menu and returns focus to the button, and Tab or a click elsewhere closes it.
 */
export function Menu({ label, trigger, items, triggerClassName }: MenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();
  const container = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const itemElements = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!isOpen) return;
    itemElements.current[0]?.focus();

    function closeOnOutsidePointer(event: PointerEvent) {
      if (!container.current?.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [isOpen]);

  function closeAndReturnFocus() {
    setIsOpen(false);
    button.current?.focus();
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const focusedIndex = itemElements.current.findIndex((item) => item === document.activeElement);
    const lastIndex = items.length - 1;
    const targetIndexByKey: Partial<Record<string, number>> = {
      ArrowDown: focusedIndex >= lastIndex ? 0 : focusedIndex + 1,
      ArrowUp: focusedIndex <= 0 ? lastIndex : focusedIndex - 1,
      Home: 0,
      End: lastIndex,
    };

    if (event.key === "Escape") {
      event.preventDefault();
      closeAndReturnFocus();
      return;
    }
    if (event.key === "Tab") {
      setIsOpen(false);
      return;
    }
    const targetIndex = targetIndexByKey[event.key];
    if (targetIndex === undefined) return;
    event.preventDefault();
    itemElements.current[targetIndex]?.focus();
  }

  return (
    <div ref={container} className="relative">
      <button
        ref={button}
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        onClick={() => setIsOpen((wasOpen) => !wasOpen)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setIsOpen(true);
          }
        }}
        className={
          triggerClassName ??
          "flex size-9 items-center justify-center rounded-control text-label-secondary transition-colors duration-150 ease-standard hover:bg-fill hover:text-label focus-visible:focus-ring aria-expanded:bg-fill aria-expanded:text-label"
        }
      >
        {trigger}
      </button>

      {isOpen && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={handleMenuKeyDown}
          className={classNames(
            "absolute top-full inset-e-0 z-30 mt-1.5 flex min-w-48 flex-col rounded-card bg-surface-raised p-1.5 shadow-float hairline-ring",
            "origin-top-right rtl:origin-top-left motion-safe:transition-[opacity,scale] motion-safe:duration-150 motion-safe:starting:scale-95 starting:opacity-0",
          )}
        >
          {items.map((item, index) => (
            <button
              key={item.label}
              ref={(element) => {
                itemElements.current[index] = element;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                // Focus goes back to the button first, so a dialog the item opens
                // knows where to return focus when it closes.
                closeAndReturnFocus();
                item.onSelect();
              }}
              className={classNames(
                "flex h-8 items-center gap-2.5 rounded-[6px] px-2.5 text-start text-body outline-none",
                "focus:bg-accent-fill focus:text-on-accent hover:bg-fill",
                item.tone === "danger" ? "text-danger" : "text-label",
              )}
            >
              {item.icon && <item.icon aria-hidden="true" strokeWidth={1.75} className="size-4" />}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
