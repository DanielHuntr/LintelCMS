/** Joins class names, leaving out empty ones: `classNames("a", false && "b", "c")` is "a c". */
export function classNames(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}
