import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { t } from "../i18n/strings.js";
import { classNames } from "./classNames.js";

interface DialogProps {
  open: boolean;
  /** Called for Escape, the close button and (for sheets) a click on the dimmed page. */
  onClose: () => void;
  title: string;
  description?: string;
  /**
   * "alert" is a small centred box for a question with two answers.
   * "sheet" is a taller panel for a task, such as editing a choice.
   * "wide" uses the screen for a task with a lot to see, such as picking a field type.
   */
  size?: "alert" | "sheet" | "wide";
  /** For dialogs that lay out their own body (columns that scroll on their own). */
  bodyClassName?: string;
  /** Buttons along the bottom. The main action goes last, on the right. */
  footer?: ReactNode;
  children?: ReactNode;
}

/**
 * A modal dialog built on the native `<dialog>` element. Put `data-autofocus` on the control
 * that should have focus when it opens; otherwise the browser picks the first one. `showModal()` gives us the things
 * that are easy to get wrong by hand: the page behind becomes inert, focus stays inside and
 * Escape closes it. We add focus going back to whatever opened the dialog.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  size = "sheet",
  footer,
  children,
  bodyClassName,
}: DialogProps) {
  const dialogElement = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const isAlert = size === "alert";

  useEffect(() => {
    const dialog = dialogElement.current;
    if (!dialog || !open) return;

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    // React's autoFocus runs before the dialog is shown, when nothing inside can take focus,
    // so dialogs mark their starting point with data-autofocus instead.
    dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();

    return () => {
      dialog.close();
      opener?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogElement}
      role={isAlert ? "alertdialog" : "dialog"}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        // Let React own the open state: closing here would leave `open` out of step.
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // A click on the dialog element itself is a click on the backdrop around the panel.
        if (!isAlert && event.target === event.currentTarget) onClose();
      }}
      className={classNames(
        "m-auto w-[calc(100vw-32px)] overflow-hidden",
        size === "wide"
          ? "h-[min(680px,calc(100vh-48px))] max-h-[calc(100vh-48px)]"
          : "max-h-[min(720px,calc(100vh-48px))]",
        "rounded-panel bg-surface-raised p-0 text-label shadow-float backdrop:bg-scrim",
        "motion-safe:transition-[opacity,scale] motion-safe:duration-200 motion-safe:ease-standard",
        "motion-safe:starting:scale-95 starting:opacity-0",
        isAlert ? "max-w-[340px]" : size === "wide" ? "max-w-[960px]" : "max-w-[540px]",
      )}
    >
      <div className={classNames("flex max-h-[inherit] flex-col", size === "wide" && "h-full")}>
        <header
          className={classNames(
            "flex shrink-0 items-start gap-3",
            isAlert ? "px-6 pt-6 text-center" : "px-6 pt-5 pb-3",
          )}
        >
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-headline text-label">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-footnote text-label-secondary">
                {description}
              </p>
            )}
          </div>
          {!isAlert && (
            <button
              type="button"
              onClick={onClose}
              aria-label={t("dialog.close")}
              className="-me-2 flex size-8 shrink-0 items-center justify-center rounded-full bg-fill text-label-secondary transition-colors duration-150 ease-standard hover:text-label focus-visible:focus-ring"
            >
              <X aria-hidden="true" strokeWidth={2.25} className="size-4" />
            </button>
          )}
        </header>

        {children && (
          <div
            className={
              bodyClassName ??
              classNames("min-h-0 overflow-y-auto", isAlert ? "px-6 pt-2" : "px-6 pb-4")
            }
          >
            {children}
          </div>
        )}

        {footer && (
          <footer
            className={classNames(
              "flex shrink-0 gap-2",
              isAlert ? "px-6 pt-5 pb-6 [&>*]:flex-1" : "justify-end px-6 pt-3.5 pb-4 hairline-top",
            )}
          >
            {footer}
          </footer>
        )}
      </div>
    </dialog>
  );
}
