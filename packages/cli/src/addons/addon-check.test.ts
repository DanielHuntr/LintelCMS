import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { namesProperty, tablesNotThroughTableFor } from "@lintel/core/postgres-only-rules";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Terminal } from "../terminal.js";
import { buildAddon } from "./addon-build.js";
import {
  breaksItsPromise,
  checkAddon,
  readAddonBundleForMysql,
  readAddonSourceForMysql,
} from "./addon-check.js";
import { scaffoldAddon } from "./addon-scaffold.js";

const PACKAGES = fileURLToPath(new URL("../../../", import.meta.url));
const ADMIN_PACKAGES = join(PACKAGES, "admin", "node_modules");

function recordingTerminal(workingFolder: string) {
  const said: string[] = [];
  const terminal: Terminal = {
    say: (line = "") => said.push(line),
    warn: (line) => said.push(`! ${line}`),
    ask: async () => "",
    workingFolder,
  };
  return { terminal, said };
}

let folder: string;

beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), "lintel-addon-check-"));
});

afterEach(async () => {
  await rm(folder, { recursive: true, force: true });
});

const PACKAGE_FILE = JSON.stringify({
  name: "lintel-addon-stamps",
  version: "0.1.0",
  type: "module",
  "lintel-addon": { id: "stamps", lintel: ">=1.0.0-rc.1", server: "dist/server.js" },
});

const INDEX = `
  import { definePlugin } from "@lintel/core/plugin";
  import { stampsTable } from "./stamps.table.js";
  export default definePlugin({
    id: "stamps",
    name: "Stamps",
    description: "Loyalty stamps.",
    database: { tables: [stampsTable], migrationsFolder: "a", mysqlMigrationsFolder: "b" },
  });
`;

function writeAddon(files: Record<string, string>): string {
  const addon = join(folder, "stamps");
  mkdirSync(join(addon, "src", "server"), { recursive: true });
  writeFileSync(join(addon, "package.json"), PACKAGE_FILE);
  writeFileSync(join(addon, "src", "server", "index.ts"), INDEX);
  for (const [name, source] of Object.entries(files)) {
    writeFileSync(join(addon, "src", "server", name), source);
  }
  return addon;
}

describe("whether an add-on keeps its promise to run on MySQL", () => {
  it.each(["addon-newsletter", "addon-instagram", "plugin-example-bookings"])(
    "finds nothing in %s, which says it does",
    (name) => {
      const found = readAddonSourceForMysql(join(PACKAGES, name));
      expect(found).toEqual({ saysItRunsOnMysql: true, hasTables: true, problems: [] });
    },
  );

  it.each(["addon-example", "addon-extra-fields"])(
    "finds nothing in %s, which has no tables",
    (name) => {
      const found = readAddonSourceForMysql(join(PACKAGES, name));
      expect(found).toEqual({ saysItRunsOnMysql: false, hasTables: false, problems: [] });
    },
  );

  it("finds what only Postgres has, and tables that skip tableFor", () => {
    const addon = writeAddon({
      "stamps.repository.ts": `
        import { ilike, sql } from "drizzle-orm";
        import { stampsTable } from "./stamps.table.js";
        export const add = (database, row) =>
          database.insert(stampsTable).values(row).returning();
        export const find = (database, text) =>
          database.select().from(stampsTable).where(ilike(stampsTable.owner, text));
        export const raw = (id) => sql\`\${id}::uuid\`;
      `,
    });
    const found = readAddonSourceForMysql(addon);
    expect(found.saysItRunsOnMysql).toBe(true);
    expect(breaksItsPromise(found)).toBe(true);
    expect(found.problems).toEqual([
      "src/server/stamps.repository.ts: only Postgres has this: returning (1)",
      "src/server/stamps.repository.ts: only Postgres has this: ilike (1)",
      "src/server/stamps.repository.ts: only Postgres has this: cast with :: (1)",
      "src/server/stamps.repository.ts:5: get this table through tableFor",
      "src/server/stamps.repository.ts:7: get this table through tableFor",
    ]);
  });

  it("leaves an add-on alone that stays off on MySQL", () => {
    const addon = writeAddon({
      "index.ts": `
        import { definePlugin } from "@lintel/core/plugin";
        export default definePlugin({
          id: "stamps", name: "Stamps", description: "Loyalty stamps.",
          database: { tables: [], migrationsFolder: "a" },
        });`,
      "stamps.repository.ts": `export const add = (database, table, row) =>
        database.insert(table).values(row).returning();`,
    });
    const found = readAddonSourceForMysql(addon);
    expect(found).toMatchObject({ saysItRunsOnMysql: false, hasTables: true });
    expect(breaksItsPromise(found)).toBe(false);
  });

  it("holds an add-on with no tables to it too, as nothing keeps that one off", () => {
    const addon = writeAddon({
      "index.ts": `export default { id: "stamps" };`,
      "stamps.service.ts": `import { sql } from "drizzle-orm";
        export const list = (database) => database.execute(sql\`select data->>'a' from x\`);`,
    });
    expect(breaksItsPromise(readAddonSourceForMysql(addon))).toBe(true);
  });

  it("stops the build of an add-on that breaks it", async () => {
    const addon = writeAddon({
      "stamps.table.ts": "export const stampsTable = {};",
      "stamps.repository.ts": `export const add = (database, table, row) =>
        database.insert(table).values(row).returning();`,
    });
    const { terminal } = recordingTerminal(folder);
    await expect(buildAddon(addon, { watch: false, terminal })).rejects.toThrow(
      "would fail on MySQL and MariaDB",
    );
  });

  it("reads a built bundle, where only the file is left", async () => {
    const bundle = join(folder, "server.js");
    writeFileSync(
      bundle,
      `var import_drizzle_orm = __toESM(require_drizzle_orm());
       var def = { mysqlMigrationsFolder: "b", migrationsFolder: "a" };
       const a = database.insert(t).values(r).onConflictDoNothing();
       const b = (0, import_drizzle_orm.ilike)(t.a, "x");
       const c = import_drizzle_orm.sql\`\${t.data}->>'title'\`;`,
    );
    expect(readAddonBundleForMysql(bundle).problems).toEqual([
      "server.js: only Postgres has this: upsert (1)",
      "server.js: only Postgres has this: ilike (1)",
      "server.js: only Postgres has this: json field access (1)",
    ]);
  });

  it("reads code rather than comments", () => {
    expect(namesProperty(ts, "a.ts", "// mysqlMigrationsFolder: x", "mysqlMigrationsFolder")).toBe(
      false,
    );
    expect(
      tablesNotThroughTableFor(
        ts,
        "a.ts",
        `import { type RowOf, stampsTable as stamps } from "./stamps.table.js";
         const fine = tableFor(database, stamps);
         type Row = typeof stamps.$inferSelect;
         // stamps in a comment
         const definition = { tables: [stamps] };
         const wrong = database.select().from(stamps);`,
      ),
    ).toEqual([6]);
  });
});

describe("lintel addons check", () => {
  it("passes the add-on `lintel addons new` makes", async () => {
    const { terminal, said } = recordingTerminal(folder);
    const addon = await scaffoldAddon({ name: "star-ratings", terminal });
    said.length = 0;
    expect(await checkAddon(addon, terminal)).toBe(0);
    expect(said.at(-1)).toContain("nothing here is only for Postgres");
  });

  it("says what's wrong, and fails", async () => {
    const addon = writeAddon({
      "stamps.repository.ts": `export const add = (database, table, row) =>
        database.insert(table).values(row).returning();`,
    });
    const { terminal, said } = recordingTerminal(folder);
    expect(await checkAddon(addon, terminal)).toBe(1);
    expect(said).toContain(
      "  src/server/stamps.repository.ts: only Postgres has this: returning (1)",
    );
  });

  it("finds a column the MySQL migrations are missing", async () => {
    const copy = join(folder, "addon-newsletter");
    cpSync(join(PACKAGES, "addon-newsletter"), copy, {
      recursive: true,
      filter: (path) => !/node_modules/.test(path),
    });
    const { terminal, said } = recordingTerminal(folder);
    await buildAddon(copy, {
      watch: false,
      terminal,
      nodePaths: [ADMIN_PACKAGES, join(PACKAGES, "addon-newsletter", "node_modules")],
    });
    said.length = 0;
    expect(await checkAddon(copy, terminal)).toBe(0);

    const snapshot = join(copy, "migrations-mysql", "meta", "0000_snapshot.json");
    const table = "newsletter_connection";
    const parsed = JSON.parse(
      await import("node:fs").then((fs) => fs.readFileSync(snapshot, "utf8")),
    );
    delete parsed.tables[table].columns.list_name;
    writeFileSync(snapshot, JSON.stringify(parsed));
    said.length = 0;
    expect(await checkAddon(copy, terminal)).toBe(1);
    expect(said).toContain(`  The MySQL migrations don't make the column ${table}.list_name.`);
  }, 60_000);
});
