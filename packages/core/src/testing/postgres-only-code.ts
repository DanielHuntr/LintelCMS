import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

/**
 * Finds code that only Postgres can run, by reading the source rather than searching it, so
 * comments and ordinary strings don't count. See `postgres-only-code.test.ts`.
 */

export const SOURCE_FOLDER = fileURLToPath(new URL("..", import.meta.url));
export const BASELINE_FILE = fileURLToPath(
  new URL("./postgres-only-code-baseline.json", import.meta.url),
);

/** Each file's count of each kind of Postgres-only code. */
export type PostgresOnlyCounts = Record<string, Record<string, number>>;

/** Method calls with no MySQL form. */
const METHODS = new Map([
  ["returning", "returning"],
  ["onConflictDoUpdate", "upsert"],
  ["onConflictDoNothing", "upsert"],
  ["selectDistinctOn", "distinct on"],
]);

/** Drizzle helpers with no MySQL form. */
const DRIZZLE_IMPORTS = new Map([
  ["ilike", "ilike"],
  ["notIlike", "ilike"],
  ["arrayContains", "array operators"],
  ["arrayContained", "array operators"],
  ["arrayOverlaps", "array operators"],
]);

/** What gives raw SQL away. The first text of each `sql` template is checked against all. */
const RAW_SQL: Record<string, RegExp> = {
  "cast with ::": /::\s*[a-z]/i,
  "json field access": /->/,
  "json containment": /@>/,
  "jsonb function": /\bjsonb?_[a-z_]+\s*\(|\brow_to_json\b/i,
  "array function": /\barray_[a-z]+\s*\(|\barray\[|=\s*any\s*\(/i,
  "full-text search": /\bto_tsvector\b|\bto_tsquery\b|\bts_rank\b|@@/i,
  "advisory lock": /\bpg_advisory/i,
  "postgres function": /\bpg_[a-z_]+\s*\(|\bhashtext\b/i,
  "filter clause": /\bfilter\s*\(\s*where\b/i,
  "nulls ordering": /\bnulls\s+(last|first)\b/i,
  "date function": /\bto_char\b|\bmake_interval\b|\bat\s+time\s+zone\b/i,
  "ilike in sql": /\bilike\b/i,
  "truncate cascade": /\btruncate\b/i,
  "postgres catalogue": /\bshow\s+server_version\b|\bdrizzle\.__drizzle/i,
};

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

function templateText(node: ts.TemplateLiteral): string {
  if (ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join(" ${} ");
}

function isSqlTag(tag: ts.Expression): boolean {
  return ts.isIdentifier(tag) && tag.text === "sql";
}

export function postgresOnlyCodeIn(fileName: string, source: string): Record<string, number> {
  const parsed = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const counts: Record<string, number> = {};
  const count = (rule: string) => {
    counts[rule] = (counts[rule] ?? 0) + 1;
  };

  const drizzleCalls = new Map<string, string>();

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const rule = METHODS.get(node.expression.name.text);
      if (rule) count(rule);
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const rule = drizzleCalls.get(node.expression.text);
      if (rule) count(rule);
    }
    if (ts.isTaggedTemplateExpression(node) && isSqlTag(node.tag)) {
      const text = templateText(node.template);
      for (const [rule, pattern] of Object.entries(RAW_SQL)) {
        if (pattern.test(text)) count(rule);
      }
    }
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      visitImport(node);
    }
    ts.forEachChild(node, visit);
  }

  function visitImport(node: ts.ImportDeclaration): void {
    const from = (node.moduleSpecifier as ts.StringLiteral).text;
    if (from === "drizzle-orm") {
      const bindings = node.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          const rule = DRIZZLE_IMPORTS.get((element.propertyName ?? element.name).text);
          if (rule) drizzleCalls.set(element.name.text, rule);
        }
      }
    }
    if (from === "drizzle-orm/pg-core" && !fileName.endsWith(".table.ts")) {
      if (!fileName.endsWith(".tables.ts") && !node.importClause?.isTypeOnly) {
        count("pg-core import");
      }
    }
  }

  visit(parsed);
  return counts;
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
