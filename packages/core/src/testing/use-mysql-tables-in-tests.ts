import { fileURLToPath } from "node:url";

/**
 * When the whole suite runs on MySQL, tests read and write tables directly to set things up
 * and to check them, and they import the Postgres tables to do so. This swaps those imports
 * in test code alone for each table's MySQL form, so 300 test files don't each need
 * `tableFor`. Lintel's own code isn't touched: it must get its tables through `tableFor`, and
 * `refuse-postgres-tables-on-mysql.ts` fails any query that doesn't.
 */

const TABLE_FOR = fileURLToPath(new URL("../database/dialect/mysql-tables.ts", import.meta.url));

/** Test files and the helpers that only tests use. */
function isTestCode(path: string): boolean {
  const file = path.replaceAll("\\", "/").split("?")[0] ?? "";
  if (!file.includes("/src/")) return false;
  // Checks how a Postgres table becomes a MySQL one, so it needs the Postgres table.
  if (file.endsWith("/mysql-tables.test.ts")) return false;
  // These use `tableFor` themselves, and hand tables to code that wants the Postgres one.
  if (file.endsWith(".dialects.test.ts")) return false;
  return (
    file.endsWith(".test.ts") ||
    /\/src\/testing\/[^/]+\.ts$/.test(file) ||
    /\/test-[^/]+\.ts$/.test(file) ||
    /-test-server\.ts$/.test(file)
  );
}

const TABLE_IMPORT = /import\s*\{([^}]*)\}\s*from\s*"([^"]*\.tables?\.js)";/g;

function rewrite(code: string): string | undefined {
  const swaps: string[] = [];
  const rewritten = code.replace(TABLE_IMPORT, (statement: string, names: string, from: string) => {
    const kept = names
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name !== "")
      .map((name) => {
        const [original, local = original] = name.split(/\s+as\s+/);
        if (!original || original.startsWith("type ") || !/Table$/.test(original)) return name;
        swaps.push(`const ${local} = mysqlTableForTests(postgres_${local});`);
        return `${original} as postgres_${local}`;
      });
    return `import { ${kept.join(", ")} } from "${from}";`;
  });
  if (swaps.length === 0) return undefined;
  const imports = [...rewritten.matchAll(/^import[^;]*;\s*$/gm)];
  const last = imports.at(-1);
  const end = last ? (last.index ?? 0) + last[0].length : 0;
  return (
    `${rewritten.slice(0, end)}\n` +
    `import { mysqlTableFor as mysqlTableForTests } from ${JSON.stringify(TABLE_FOR)};\n` +
    `${swaps.join("\n")}\n${rewritten.slice(end)}`
  );
}

export function useMysqlTablesInTests() {
  return {
    name: "lintel-use-mysql-tables-in-tests",
    enforce: "pre" as const,
    transform(code: string, id: string) {
      if (!isTestCode(id)) return undefined;
      const rewritten = rewrite(code);
      return rewritten === undefined ? undefined : { code: rewritten, map: null };
    },
  };
}
