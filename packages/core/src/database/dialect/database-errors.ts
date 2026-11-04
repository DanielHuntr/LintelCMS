/**
 * Telling what a failed write means, on any database. Drizzle wraps the driver's error, so
 * these look through `cause`. Postgres reports 23505; MySQL and MariaDB report 1062.
 */

interface DriverError {
  code?: unknown;
  errno?: unknown;
  sqlMessage?: unknown;
  cause?: unknown;
}

function chainOf(error: unknown): DriverError[] {
  const chain: DriverError[] = [];
  let current: unknown = error;
  while (typeof current === "object" && current !== null && chain.length < 5) {
    chain.push(current);
    current = (current as DriverError).cause;
  }
  return chain;
}

export function isUniqueViolation(error: unknown): boolean {
  return chainOf(error).some(
    (link) => link.code === "23505" || link.code === "ER_DUP_ENTRY" || link.errno === 1062,
  );
}

/** Which key a MySQL duplicate error names: "for key 'table.name'", or 'name' on MariaDB. */
export function uniqueKeyInViolation(error: unknown): string | undefined {
  for (const { sqlMessage } of chainOf(error)) {
    if (typeof sqlMessage !== "string") continue;
    const match = /for key '(?:[^'.]*\.)?([^']*)'/.exec(sqlMessage);
    if (match) return match[1];
  }
  return undefined;
}
