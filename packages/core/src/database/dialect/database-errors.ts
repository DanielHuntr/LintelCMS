/** What each database calls a broken unique key. See `isUniqueViolation`. */
export const UNIQUE_VIOLATION_CODES: readonly string[] = ["23505", "ER_DUP_ENTRY"];

/** Which key a MySQL duplicate error names: "for key 'table.name'", or 'name' on MariaDB. */
export function uniqueKeyInViolation(error: unknown): string | undefined {
  for (let current = error, depth = 0; current instanceof Error && depth < 5; depth += 1) {
    const match = /for key '(?:[^'.]*\.)?([^']*)'/.exec(current.message);
    if (match) return match[1];
    current = current.cause;
  }
  return undefined;
}
