import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { postgresOnlyCodeIn as findPostgresOnlyCode } from "../database/dialect/postgres-only-rules.js";

/**
 * Finds code that only Postgres can run across Lintel's own source, using the rules in
 * `postgres-only-rules.ts`. See `postgres-only-code.test.ts`.
 */

export const SOURCE_FOLDER = fileURLToPath(new URL("..", import.meta.url));
export const BASELINE_FILE = fileURLToPath(
  new URL("./postgres-only-code-baseline.json", import.meta.url),
);

/** Each file's count of each kind of Postgres-only code. */
export type PostgresOnlyCounts = Record<string, Record<string, number>>;

/** Folders and files that may hold Postgres-only code. */
function isChecked(file: string): boolean {
  const path = file.replaceAll("\\", "/");
  return (
    path.endsWith(".ts") &&
    !path.endsWith(".test.ts") &&
    !path.startsWith("testing/") &&
    !path.startsWith("database/dialect/") &&
    !path.startsWith("cli/templates/")
  );
}

function allFiles(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    return entry.isDirectory() ? allFiles(path) : [path];
  });
}

export function postgresOnlyCodeIn(fileName: string, source: string): Record<string, number> {
  return findPostgresOnlyCode(ts, fileName, source);
}

/** The whole of `packages/core/src`, keyed by path, leaving out files with nothing to report. */
export function scanForPostgresOnlyCode(): PostgresOnlyCounts {
  const found: PostgresOnlyCounts = {};
  for (const path of allFiles(SOURCE_FOLDER).sort()) {
    const file = relative(SOURCE_FOLDER, path).replaceAll("\\", "/");
    if (!isChecked(file)) continue;
    const counts = postgresOnlyCodeIn(file, readFileSync(path, "utf8"));
    if (Object.keys(counts).length > 0) {
      found[file] = Object.fromEntries(Object.entries(counts).sort());
    }
  }
  return found;
}

export function readBaseline(): PostgresOnlyCounts {
  return JSON.parse(readFileSync(BASELINE_FILE, "utf8")) as PostgresOnlyCounts;
}

export interface BaselineDifference {
  /** New Postgres-only code. These must be moved to the dialect helpers. */
  added: string[];
  /** Code that has gone, so the list should shrink too. */
  removed: string[];
}

export function compareWithBaseline(
  found: PostgresOnlyCounts,
  baseline: PostgresOnlyCounts,
): BaselineDifference {
  const added: string[] = [];
  const removed: string[] = [];
  for (const file of new Set([...Object.keys(found), ...Object.keys(baseline)])) {
    const now = found[file] ?? {};
    const before = baseline[file] ?? {};
    for (const rule of new Set([...Object.keys(now), ...Object.keys(before)])) {
      const difference = (now[rule] ?? 0) - (before[rule] ?? 0);
      const line = `${file}: ${rule} (${before[rule] ?? 0} -> ${now[rule] ?? 0})`;
      if (difference > 0) added.push(line);
      if (difference < 0) removed.push(line);
    }
  }
  return { added, removed };
}

export function totalsByRule(counts: PostgresOnlyCounts): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const fileCounts of Object.values(counts)) {
    for (const [rule, count] of Object.entries(fileCounts)) {
      totals[rule] = (totals[rule] ?? 0) + count;
    }
  }
  return Object.fromEntries(Object.entries(totals).sort(([, a], [, b]) => b - a));
}
