import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { SOURCE_FOLDER } from "./postgres-only-code.js";

/**
 * MySQL can undo a transaction to break a deadlock, and Lintel then runs its callback again
 * (`retryTransactionsAfterDeadlock`). So a callback mustn't reach outside the database, or add
 * to anything from outside itself unless it empties it first. This reads every transaction in
 * core. It sees what a callback does itself, not what the functions it calls do: they were
 * traced once, on 2026-11-04 (see docs/qa/FIX-LOG-mysql.md).
 */

const OUTSIDE_EFFECTS = /^(fetch|sendEmail|send|publish|put|writeFile|rm|unlink|rename|mkdir)$/;
const ADDS = /^(push|add|set|unshift|splice)$/;

/** Reviewed, with why each is safe. */
const ALLOWED = new Map([
  // A read-only snapshot takes no locks, so it can't be undone to break a deadlock.
  ["backups/backup-archive.service.ts: addJson", "writes the archive as it reads"],
]);

function allFiles(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    return entry.isDirectory() ? allFiles(path) : [path];
  });
}

/** Names the callback made itself, so what it adds to them is thrown away with it. */
function namesInside(callback: ts.Node): Set<string> {
  const names = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (
      (ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node)) &&
      ts.isIdentifier(node.name)
    ) {
      names.add(node.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(callback);
  return names;
}

function emptiedFirst(callback: ts.Node, name: string): boolean {
  return new RegExp(`\\b${name}\\.length = 0|\\b${name} = \\[\\]`).test(callback.getText());
}

export function problemsIn(fileName: string, source: string): string[] {
  const parsed = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const problems: string[] = [];

  function checkCallback(callback: ts.Node): void {
    const inside = namesInside(callback);
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        const called = node.expression;
        const name = ts.isIdentifier(called)
          ? called.text
          : ts.isPropertyAccessExpression(called)
            ? called.name.text
            : "";
        if (OUTSIDE_EFFECTS.test(name) || name === "addJson") problems.push(`${fileName}: ${name}`);
        if (
          ts.isPropertyAccessExpression(called) &&
          ADDS.test(called.name.text) &&
          ts.isIdentifier(called.expression) &&
          !inside.has(called.expression.text) &&
          !emptiedFirst(callback, called.expression.text)
        ) {
          problems.push(`${fileName}: ${called.expression.text}.${called.name.text}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(callback);
  }

  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "transaction" &&
      node.arguments[0]
    ) {
      checkCallback(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  return problems;
}

describe("transactions that may run twice", () => {
  it("do nothing outside the database, and collect nothing from an undone try", () => {
    const problems = allFiles(SOURCE_FOLDER)
      .filter((path) => path.endsWith(".ts") && !/\.test\.ts$|[\\/]testing[\\/]/.test(path))
      .flatMap((path) =>
        problemsIn(relative(SOURCE_FOLDER, path).replaceAll("\\", "/"), readFileSync(path, "utf8")),
      )
      .filter((problem) => !ALLOWED.has(problem));
    expect(problems).toEqual([]);
  });

  it("finds an email in a transaction, and a list that keeps an undone try", () => {
    const found = problemsIn(
      "a.service.ts",
      `const sent = [];
       await database.transaction(async (transaction) => {
         await sendEmail(message);
         sent.push(1);
         const mine = [];
         mine.push(2);
       });`,
    );
    expect(found).toEqual(["a.service.ts: sendEmail", "a.service.ts: sent.push"]);
  });

  it("allows a list that starts empty each time", () => {
    const found = problemsIn(
      "a.service.ts",
      `const sent = [];
       await database.transaction(async (transaction) => {
         sent.length = 0;
         sent.push(1);
       });`,
    );
    expect(found).toEqual([]);
  });
});
