import { type KeyboardEvent, type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { classNames } from "../design/classNames.js";

interface ModalProps {
  /** The id of the heading that names the dialog. */
  labelledBy: string;
  describedBy?: string;
  onClose: () => void;
  /** "sheet" for big working views, "dialog" for pickers, "alert" for confirmations. */
  size: "sheet" | "dialog" | "alert";
  children: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const sizeClasses = {
  sheet: "h-[min(860px,calc(100vh-48px))] w-[min(1180px,calc(100vw-48px))]",
  dialog: "h-[min(760px,calc(100vh-48px))] w-[min(920px,calc(100vw-48px))]",
  alert: "w-[min(420px,calc(100vw-48px))]",
};

/**
 * A window above the page. While it is open, Tab and Shift+Tab stay inside it, Escape closes
 * it, and closing puts focus back where it was, so keyboard and screen reader users never
 * get lost behind it. Modals can stack: Escape only closes the top one.
 */
export function Modal({ labelledBy, describedBy, onClose, size, children }: ModalProps) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const focusedBefore = document.activeElement;
    // Mark an element with data-autofocus to focus it first, such as a search field.
    const target =
      panel.current?.querySelector<HTMLElement>("[data-autofocus]") ??
      panel.current?.querySelector<HTMLElement>(FOCUSABLE);
    (target ?? panel.current)?.focus();

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      if (focusedBefore instanceof HTMLElement) focusedBefore.focus();
    };
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      // A stacked modal is rendered inside its parent's React tree, so stop here.
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key === "Tab") {
      keepFocusInside(event);
    }
  }

  function keepFocusInside(event: KeyboardEvent<HTMLDivElement>) {
    // Skips things taken out of the Tab order, such as the hidden file inputs behind Upload.
    const focusable = [...(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter(
      (element) => element.tabIndex >= 0,
    );
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) {
      event.preventDefault();
      return;
    }
    const isOutside = !panel.current?.contains(document.activeElement);
    if (event.shiftKey && (document.activeElement === first || isOutside)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || isOutside)) {
      event.preventDefault();
      first.focus();
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-6"
      onKeyDown={handleKeyDown}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[rgb(0_0_0/0.32)] backdrop-blur-[2px] transition-opacity duration-200 ease-standard starting:opacity-0"
        onClick={size === "alert" ? undefined : onClose}
      />
      <div
        ref={panel}
        role={size === "alert" ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={classNames(
          "relative flex flex-col overflow-hidden rounded-panel bg-surface text-label shadow-float hairline-ring outline-none",
          "transition duration-200 ease-standard starting:opacity-0 motion-safe:starting:scale-[0.98]",
          sizeClasses[size],
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
