import { ApiError, type FieldMessages } from "../api/client.js";

/** The per-field messages in a failed save, or none when the failure wasn't about fields. */
export function fieldErrorsFrom(error: unknown): FieldMessages {
  return error instanceof ApiError && error.fields ? error.fields : {};
}

/** The first field, in the order they appear on screen, that has an error. */
export function firstFieldWithError(
  handlesInOrder: readonly string[],
  errors: FieldMessages,
): string | undefined {
  return handlesInOrder.find((handle) => handle in errors);
}

/**
 * Errors for things the form doesn't show as fields; these go in the banner instead.
 * A message for a field inside another ("sections.<block id>.heading") is shown inside it.
 */
export function errorsWithoutAField(
  handlesInOrder: readonly string[],
  errors: FieldMessages,
): string[] {
  return Object.entries(errors)
    .filter(([key]) => !handlesInOrder.includes(key.split(".")[0] ?? key))
    .map(([, message]) => message);
}

/**
 * Where focus should go for a field's problem: the first field inside it that has one
 * (a block's heading), or the field itself.
 */
export function focusTargetFor(handle: string, errors: FieldMessages): string {
  return Object.keys(errors).find((key) => key.startsWith(`${handle}.`)) ?? handle;
}

/**
 * Moves focus to a field's control, so keyboard and screen reader users land on the problem.
 * Fields mark their outer element with `data-field-handle`; the first control inside wins.
 */
export function focusField(container: HTMLElement, handle: string): void {
  const fieldElement = [...container.querySelectorAll<HTMLElement>("[data-field-handle]")].find(
    (element) => element.dataset.fieldHandle === handle,
  );
  if (!fieldElement) return;

  const control = fieldElement.querySelector<HTMLElement>(
    'input:not([type="hidden"]), textarea, select, button, [contenteditable="true"]',
  );
  const target = control ?? fieldElement;
  if (!control) target.tabIndex = -1;
  target.focus();
  const prefersLessMotion =
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  target.scrollIntoView?.({ block: "center", behavior: prefersLessMotion ? "auto" : "smooth" });
}
