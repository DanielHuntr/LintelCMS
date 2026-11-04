import type ts from "typescript";

/**
 * What can only run on Postgres, found by reading the source rather than searching it, so
 * comments and ordinary strings don't count. Two checks use this: the one over Lintel's own
 * code (`src/testing/postgres-only-code.test.ts`) and `lintel addons check` for an add-on's.
 * Each hands in TypeScript's parser, so that a running server never has to load it.
 */

export type TypeScript = typeof ts;

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

/**
 * A Date put straight into raw SQL works on the built-in database and fails on a Postgres
 * server, whose driver only takes text. Compare with a column instead, which converts it.
 */
const DATE_NAMES = /^(now|since|cutoff|until|today)$|(At|Date|Time)$/;

function templateText(parser: TypeScript, node: ts.TemplateLiteral): string {
  if (parser.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join(" ${} ");
}

/** `sql`, or in an add-on's bundle, `import_drizzle_orm.sql`. */
function isSqlTag(parser: TypeScript, tag: ts.Expression): boolean {
  if (parser.isPropertyAccessExpression(tag)) return tag.name.text === "sql";
  return parser.isIdentifier(tag) && tag.text === "sql";
}

/** Each kind of Postgres-only code in one file, with how many times it appears. */
export function postgresOnlyCodeIn(
  parser: TypeScript,
  fileName: string,
  source: string,
): Record<string, number> {
  const parsed = parser.createSourceFile(fileName, source, parser.ScriptTarget.Latest, true);
  const counts: Record<string, number> = {};
  const count = (rule: string) => {
    counts[rule] = (counts[rule] ?? 0) + 1;
  };

  const drizzleCalls = new Map<string, string>();

  function visit(node: ts.Node): void {
    if (parser.isCallExpression(node) && parser.isPropertyAccessExpression(node.expression)) {
      const rule = METHODS.get(node.expression.name.text);
      if (rule) count(rule);
    }
    if (parser.isCallExpression(node) && parser.isIdentifier(node.expression)) {
      const rule = drizzleCalls.get(node.expression.text);
      if (rule) count(rule);
    }
    // In an add-on's bundle: `(0, import_drizzle_orm.ilike)(a, b)`.
    if (parser.isPropertyAccessExpression(node) && parser.isIdentifier(node.expression)) {
      const rule = DRIZZLE_IMPORTS.get(node.name.text);
      if (rule && /^import_drizzle_orm\d*$/.test(node.expression.text)) count(rule);
    }
    if (parser.isTaggedTemplateExpression(node) && isSqlTag(parser, node.tag)) {
      const text = templateText(parser, node.template);
      for (const [rule, pattern] of Object.entries(RAW_SQL)) {
        if (pattern.test(text)) count(rule);
      }
      if (parser.isTemplateExpression(node.template)) {
        for (const { expression } of node.template.templateSpans) {
          if (parser.isIdentifier(expression) && DATE_NAMES.test(expression.text)) {
            count("date in raw sql");
          }
        }
      }
    }
    if (parser.isImportDeclaration(node) && parser.isStringLiteral(node.moduleSpecifier)) {
      visitImport(node);
    }
    if (parser.isStringLiteral(node) && /^23\d{3}$/.test(node.text)) count("postgres error code");
    parser.forEachChild(node, visit);
  }

  function visitImport(node: ts.ImportDeclaration): void {
    const from = (node.moduleSpecifier as ts.StringLiteral).text;
    if (from === "drizzle-orm") {
      const bindings = node.importClause?.namedBindings;
      if (bindings && parser.isNamedImports(bindings)) {
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

/** Whether a file has this property in an object: `mysqlMigrationsFolder: ...`. */
export function namesProperty(
  parser: TypeScript,
  fileName: string,
  source: string,
  property: string,
): boolean {
  const parsed = parser.createSourceFile(fileName, source, parser.ScriptTarget.Latest, true);
  let found = false;
  const visit = (node: ts.Node): void => {
    if (
      (parser.isPropertyAssignment(node) || parser.isShorthandPropertyAssignment(node)) &&
      parser.isIdentifier(node.name) &&
      node.name.text === property
    ) {
      found = true;
    }
    if (!found) parser.forEachChild(node, visit);
  };
  visit(parsed);
  return found;
}

/** Where a table can be named without a query reading it as a Postgres table. */
function isHarmlessUse(parser: TypeScript, node: ts.Identifier): boolean {
  const parent = node.parent;
  if (parser.isImportSpecifier(parent) || parser.isTypeQueryNode(parent)) return true;
  // `typeof bookingsTable.$inferSelect`
  if (parser.isQualifiedName(parent)) return true;
  if (parser.isCallExpression(parent) && parser.isIdentifier(parent.expression)) {
    return ["tableFor", "mysqlTableFor", "getTableName"].includes(parent.expression.text);
  }
  // `tables: [bookingsTable]` in a plugin's definition.
  return (
    parser.isArrayLiteralExpression(parent) &&
    parser.isPropertyAssignment(parent.parent) &&
    parent.parent.name.getText() === "tables"
  );
}

/**
 * Lines that use a table imported from a `*.table.ts` file without `tableFor`. Such a query
 * builds on MySQL and mostly works, reading times and JSON wrongly.
 */
export function tablesNotThroughTableFor(
  parser: TypeScript,
  fileName: string,
  source: string,
): number[] {
  const parsed = parser.createSourceFile(fileName, source, parser.ScriptTarget.Latest, true);
  const tables = new Set<string>();
  for (const statement of parsed.statements) {
    if (!parser.isImportDeclaration(statement) || statement.importClause?.isTypeOnly) continue;
    const from = (statement.moduleSpecifier as ts.StringLiteral).text;
    const bindings = statement.importClause?.namedBindings;
    if (!/\.tables?(\.[jt]s)?$/.test(from) || !bindings || !parser.isNamedImports(bindings)) {
      continue;
    }
    for (const element of bindings.elements) {
      if (element.isTypeOnly) continue;
      if (/Table$/.test((element.propertyName ?? element.name).text)) {
        tables.add(element.name.text);
      }
    }
  }
  const lines = new Set<number>();
  const visit = (node: ts.Node): void => {
    if (parser.isIdentifier(node) && tables.has(node.text) && !isHarmlessUse(parser, node)) {
      lines.add(parsed.getLineAndCharacterOfPosition(node.getStart()).line + 1);
    }
    parser.forEachChild(node, visit);
  };
  visit(parsed);
  return [...lines];
}
