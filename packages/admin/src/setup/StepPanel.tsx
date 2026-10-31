import { useEffect, useId, useRef, type ReactNode } from "react";
import { t } from "../i18n/strings.js";

interface StepPanelProps {
  title: string;
  /** "Step 2 of 3". Left out for the setup code, which isn't a numbered step. */
  stepNumber?: { current: number; total: number };
  description?: string;
  /**
   * Moves focus to the step's heading when it appears. The button that led here has gone,
   * so without this, keyboard and screen-reader users would be left at the top of the page.
   */
  takesFocus?: boolean;
  children: ReactNode;
}

/** One step of setup: a raised panel with the step's number, its question and its fields. */
export function StepPanel({
  title,
  stepNumber,
  description,
  takesFocus = false,
  children,
}: StepPanelProps) {
  const titleId = useId();
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (takesFocus) heading.current?.focus();
  }, [takesFocus]);

  return (
    <section
      aria-labelledby={titleId}
      className="flex w-full flex-col rounded-panel bg-surface p-7 shadow-float"
    >
      {stepNumber && (
        <p className="mb-1 text-footnote font-medium text-label-secondary">
          {t("setup.stepOf", {
            current: String(stepNumber.current),
            total: String(stepNumber.total),
          })}
        </p>
      )}
      <h2
        id={titleId}
        ref={heading}
        tabIndex={-1}
        className="text-headline text-label outline-none"
      >
        {title}
      </h2>
      {description && <p className="mt-1 text-body text-label-secondary">{description}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

/**
 * The line under a step for messages that don't belong to one field. Always rendered, so
 * screen readers are already listening when a message arrives, but it takes no room while empty.
 */
export function StatusLine({ message }: { message: string }) {
  return (
    <p role="status" className="mt-5 text-center text-footnote text-danger empty:mt-0">
      {message}
    </p>
  );
}

/** Puts focus on the form field with this name, so the person lands on what needs fixing. */
export function focusField(form: HTMLFormElement | null, name: string) {
  const field = form?.elements.namedItem(name);
  if (field instanceof HTMLInputElement) field.focus();
}
