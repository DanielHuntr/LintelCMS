/**
 * Deep equality for JSON-like values (entry data, rich text documents). Key order doesn't
 * matter, so an entry isn't "changed" just because its fields came back in a different order.
 */
export function isSameValue(first: unknown, second: unknown): boolean {
  if (Object.is(first, second)) return true;
  if (typeof first !== "object" || typeof second !== "object" || !first || !second) return false;

  if (Array.isArray(first) || Array.isArray(second)) {
    return (
      Array.isArray(first) &&
      Array.isArray(second) &&
      first.length === second.length &&
      first.every((item, index) => isSameValue(item, second[index]))
    );
  }

  const firstRecord = first as Record<string, unknown>;
  const secondRecord = second as Record<string, unknown>;
  const keys = new Set([...Object.keys(firstRecord), ...Object.keys(secondRecord)]);
  return [...keys].every((key) => isSameValue(firstRecord[key], secondRecord[key]));
}
