/**
 * Matches an address against a plugin screen's path, where `$name` stands for one part:
 * "/bookings/$bookingId" matches "/bookings/42" with `{ bookingId: "42" }`. Trailing
 * slashes don't matter. Undefined when it doesn't match.
 */
export function matchScreenPath(
  pattern: string,
  pathname: string,
): Record<string, string> | undefined {
  const patternParts = splitPath(pattern);
  const pathParts = splitPath(pathname);
  if (patternParts.length !== pathParts.length) return undefined;

  const params: Record<string, string> = {};
  for (const [index, part] of patternParts.entries()) {
    const actual = pathParts[index] ?? "";
    if (part.startsWith("$")) {
      params[part.slice(1)] = decodeURIComponent(actual);
    } else if (part !== actual) {
      return undefined;
    }
  }
  return params;
}

function splitPath(path: string): string[] {
  return path.split("/").filter((part) => part !== "");
}
