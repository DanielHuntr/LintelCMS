/** Joins class names and skips the empty ones: `classNames("row", isSelected && "selected")`. */
export function classNames(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}
