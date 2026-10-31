/** Joins class names and skips the empty ones, so `classNames("row", isSelected && "selected")` reads plainly. */
export function classNames(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}
