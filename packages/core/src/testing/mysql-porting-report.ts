import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import ts from "typescript";
import * as schema from "../database/schema.js";
import { mysqlPortedRepositories } from "./mysql-ported-repositories.js";
import { SOURCE_FOLDER } from "./postgres-only-code.js";

/**
 * What has moved to MySQL so far, read from the source. `pnpm dialect:report` prints it, and
 * the same reading is what `mysql-ported-repositories.test.ts` checks.
 */

const QUERY_METHODS = new Set(["select", "selectDistinct", "insert", "update", "delete"]);
const QUERY_HELPERS = new Set([
  "insertReturning",
  "updateReturning",
  "deleteReturning",
  "upsert",
  "insertIfNew",
  "insertIfNewReturning",
]);

export interface RepositoryFacts {
  file: string;
  queries: number;
  /** The tables it imports, by their exported names: `sitesTable`. */
  tables: string[];
  exportedFunctions: string[];
  /** Tables used directly rather than through `tableFor`, with their line numbers. */
  directTableUses: string[];
}

function allRepositories(folder = SOURCE_FOLDER): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) return allRepositories(path);
    return entry.name.endsWith(".repository.ts") ? [path] : [];
  });
}

function isTypePosition(node: ts.Node): boolean {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isTypeNode(parent)) return true;
    if (ts.isStatement(parent)) return false;
  }
  return false;
}

function isSecondArgumentOfTableFor(node: ts.Node): boolean {
  const call = node.parent;
  return (
    ts.isCallExpression(call) &&
    ts.isIdentifier(call.expression) &&
    call.expression.text === "tableFor" &&
    call.arguments[1] === node
  );
}

export function readRepository(path: string): RepositoryFacts {
  const file = relative(SOURCE_FOLDER, path).replaceAll("\\", "/");
  const source = ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const importedTables = new Map<string, string>();
  const exportedFunctions: string[] = [];
  const directTableUses: string[] = [];
  let queries = 0;

  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement)) {
      const bindings = statement.importClause?.namedBindings;
      if (statement.importClause?.isTypeOnly || !bindings || !ts.isNamedImports(bindings)) continue;
      for (const element of bindings.elements) {
        const original = (element.propertyName ?? element.name).text;
        if (!element.isTypeOnly && original.endsWith("Table")) {
          importedTables.set(element.name.text, original);
        }
      }
    }
    const isExported = ts.canHaveModifiers(statement)
      ? ts.getModifiers(statement)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
      : false;
    if (isExported && ts.isFunctionDeclaration(statement) && statement.name) {
      exportedFunctions.push(statement.name.text);
    }
  }

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node)) return;
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isPropertyAccessExpression(callee) && QUERY_METHODS.has(callee.name.text)) queries++;
      if (ts.isIdentifier(callee) && QUERY_HELPERS.has(callee.text)) queries++;
    }
    if (
      ts.isIdentifier(node) &&
      importedTables.has(node.text) &&
      !isTypePosition(node) &&
      !isSecondArgumentOfTableFor(node)
    ) {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart());
      directTableUses.push(`${file}:${line + 1} ${node.text}`);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);

  return {
    file,
    queries,
    tables: [...new Set(importedTables.values())].sort(),
    exportedFunctions,
    directTableUses,
  };
}

/** The `.dialects.test.ts` files beside a repository, joined together. */
export function dialectTestsBeside(file: string): string {
  const folder = join(SOURCE_FOLDER, dirname(file));
  return readdirSync(folder)
    .filter((name) => name.endsWith(".dialects.test.ts"))
    .map((name) => readFileSync(join(folder, name), "utf8"))
    .join("\n");
}

export interface PortingReport {
  repositories: { ported: number; total: number };
  queries: { ported: number; total: number };
  tables: {
    total: number;
    /** Used by a moved repository. */
    reached: string[];
    /** Used only by moved repositories, so nothing still needs Postgres for them. */
    finished: string[];
  };
}

export function portingReport(): PortingReport {
  const ported = new Set(mysqlPortedRepositories);
  const facts = allRepositories().map(readRepository);
  const portedFacts = facts.filter((fact) => ported.has(fact.file));
  const others = facts.filter((fact) => !ported.has(fact.file));
  const stillPostgres = new Set(others.flatMap((fact) => fact.tables));
  const reached = [...new Set(portedFacts.flatMap((fact) => fact.tables))].sort();
  const queriesIn = (list: RepositoryFacts[]) => list.reduce((sum, fact) => sum + fact.queries, 0);

  return {
    repositories: { ported: portedFacts.length, total: facts.length },
    queries: { ported: queriesIn(portedFacts), total: queriesIn(facts) },
    tables: {
      total: Object.values(schema).filter((value) => is(value, PgTable)).length,
      reached,
      finished: reached.filter((table) => !stillPostgres.has(table)),
    },
  };
}
