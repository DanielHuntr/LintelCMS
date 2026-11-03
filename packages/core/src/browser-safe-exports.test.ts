import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The admin runs in the browser and imports a few of core's files (`@lintel/core/permissions`
 * and the like). Each must stay free of server code: one stray import of a route file can
 * pull in Fastify or `node:http`, and the admin then fails to start with a blank page. This
 * follows every import from each export the admin uses and fails on the first server-only
 * module it reaches. Type-only imports are skipped, since they vanish when compiled.
 */

const CORE_FOLDER = fileURLToPath(new URL("..", import.meta.url));
const PACKAGES_FOLDER = resolve(CORE_FOLDER, "..");
/** Folders whose code runs in the browser and may import core. */
const BROWSER_FOLDERS = [
  "admin/src",
  "plugin-example-bookings/src/admin",
  "addon-example/src/admin",
  "builder/src",
];
const SERVER_ONLY = [
  /^node:/,
  /^fastify$/,
  /^@fastify\//,
  /^drizzle-orm/,
  /^postgres$/,
  /^pg$/,
  /^@electric-sql\//,
];

/** Import and re-export specifiers that survive compiling (not `import type`). */
function runtimeImports(source: string): string[] {
  const found: string[] = [];
  const statement =
    /^\s*(import|export)\s+(type\s+)?([^;]*?)\s+from\s+["']([^"']+)["']|^\s*import\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/gm;
  for (const match of source.matchAll(statement)) {
    const [, , typeOnly, clause = "", from, sideEffect, dynamic] = match;
    const specifier = from ?? sideEffect ?? dynamic;
    if (!specifier || typeOnly) continue;
    // `import { type A, type B } from "x"` is type-only too.
    const names = /^\{([^}]*)\}$/.exec(clause.trim())?.[1];
    if (
      names &&
      names.split(",").every((name) => name.trim() === "" || name.trim().startsWith("type "))
    ) {
      continue;
    }
    found.push(specifier);
  }
  return found;
}

function sourceFileFor(fromFile: string, specifier: string): string | undefined {
  const base = resolve(dirname(fromFile), specifier);
  const candidates = [
    base.replace(/\.js$/, ".ts"),
    base.replace(/\.js$/, ".tsx"),
    `${base}.ts`,
    join(base, "index.ts"),
  ];
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
}

/** The first chain of imports from `entry` to a server-only module, or undefined. */
function findServerImport(entry: string): string[] | undefined {
  const seen = new Set<string>();
  const queue: string[][] = [[entry]];
  while (queue.length > 0) {
    const chain = queue.shift()!;
    const file = chain.at(-1)!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const specifier of runtimeImports(readFileSync(file, "utf8"))) {
      if (SERVER_ONLY.some((pattern) => pattern.test(specifier))) {
        return [...chain.map((step) => relative(CORE_FOLDER, step)), specifier];
      }
      if (specifier.startsWith(".")) {
        const next = sourceFileFor(file, specifier);
        if (next) queue.push([...chain, next]);
      }
    }
  }
  return undefined;
}

function filesIn(folder: string): string[] {
  if (!existsSync(folder)) return [];
  return readdirSync(folder, { recursive: true, encoding: "utf8" })
    .filter((name) => /\.(ts|tsx)$/.test(name) && !name.includes("node_modules"))
    .map((name) => join(folder, name));
}

/** Every `@lintel/core/<subpath>` the browser code imports at runtime. */
function subpathsUsedInTheBrowser(): string[] {
  const used = new Set<string>();
  for (const folder of BROWSER_FOLDERS) {
    for (const file of filesIn(join(PACKAGES_FOLDER, folder))) {
      for (const specifier of runtimeImports(readFileSync(file, "utf8"))) {
        if (specifier.startsWith("@lintel/core/"))
          used.add(`./${specifier.slice("@lintel/core/".length)}`);
      }
    }
  }
  return [...used].sort();
}

const packageJson = JSON.parse(readFileSync(join(CORE_FOLDER, "package.json"), "utf8")) as {
  exports: Record<string, { development?: string }>;
};

describe("core's exports for the admin", () => {
  const subpaths = subpathsUsedInTheBrowser();

  it("are found, so this check has something to check", () => {
    expect(subpaths).toEqual(expect.arrayContaining(["./permissions", "./site-presets"]));
  });

  it.each(subpaths)("%s imports no server code", (subpath) => {
    const source = packageJson.exports[subpath]?.development;
    expect(source, `${subpath} should be in package.json's exports`).toBeDefined();
    const chain = findServerImport(join(CORE_FOLDER, source!));
    expect(chain, chain && `Server code reaches the admin: ${chain.join(" → ")}`).toBeUndefined();
  });
});
