import { classNames } from "./classNames.js";

/**
 * The look of every text-like control (inputs, text areas, selects): a soft grey fill
 * instead of a border, as in macOS and iOS forms. Shared so they all match TextField.
 */
export function controlClasses({ hasError = false }: { hasError?: boolean } = {}): string {
  return classNames(
    "w-full rounded-control bg-fill px-3 text-body text-label",
    "placeholder:text-label-tertiary transition-shadow duration-150 ease-standard",
    "focus:focus-ring focus:outline-offset-0 disabled:opacity-50",
    hasError && "ring-1 ring-danger",
  );
}
