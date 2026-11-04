import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { rowsOf } from "../backups/database-snapshot.repository.js";
import { buildServer } from "../server.js";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { writeAddonsList } from "./addons-list.js";
import { type AddonsState, loadAddons } from "./load-addons.js";

/**
 * Lintel's own tables never count as an add-on's, whatever it declares or however its id
 * reads: "shop" would otherwise own shop_orders, and deleting its data would empty them.
 */

const server = `
const { definePlugin } = globalThis.__lintelAddonModules["@lintel/core/plugin"];
export default definePlugin({ id: "shop", name: "Shop extras", description: "A little extra." });
`;

const manifest = {
  id: "shop",
  lintel: ">=1.0.0-rc.1",
  tables: [
    { name: "shop_extras_notes", purpose: "Its own notes." },
    { name: "users", purpose: "Declared by mistake." },
  ],
  personalData: {
    tables: [{ name: "shop_customers", columns: [{ name: "email", personalData: true }] }],
  },
};

describe("an add-on and Lintel's own tables", () => {
  const testDatabase = useTestDatabase();
  let root: string;
  let addons: AddonsState;
  let api: FastifyInstance;
  let owner: SendRequest;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "lintel-addon-core-tables-"));
    const addonsFolder = join(root, "addons");
    const installed = join(addonsFolder, "node_modules", "lintel-shop-extras");
    await mkdir(join(installed, "dist"), { recursive: true });
    await writeFile(
      join(installed, "package.json"),
      JSON.stringify({ name: "lintel-shop-extras", version: "1.0.0", "lintel-addon": manifest }),
    );
    await writeFile(join(installed, "dist", "server.js"), server);
    await writeAddonsList(addonsFolder, {
      packages: ["lintel-shop-extras"],
      linked: [],
      enableOnStart: [],
    });
    addons = await loadAddons(addonsFolder, { lintelVersion: "1.0.0-rc.4", takenIds: [] });
  });

  beforeEach(async () => {
    api = buildServer({
      adminOrigin: "http://localhost:5173",
      database: testDatabase.activeDatabase,
      runScheduledJobs: false,
      addons,
    });
    await api.ready();
    const database = testDatabase.database;
    await database.execute(sql`drop table if exists shop_extras_notes`);
    await database.execute(sql`create table shop_extras_notes (id text primary key)`);
    await database.execute(sql`insert into shop_extras_notes values ('n1')`);
    await database.execute(sql`insert into shop_customers (email) values ('ann@example.com')`);
    await createTestUser(database, "owner@example.com", [["*"]]);
    owner = requestsAs(api, await signInAndGetCookies(api, "owner@example.com"));
  });

  afterEach(() => api.close());
  afterAll(() => rm(root, { recursive: true, force: true }));

  const count = async (table: string) => {
    const result = await testDatabase.database.execute(
      sql`select count(*)::int as total from ${sql.identifier(table)}`,
    );
    return Number(rowsOf(result)[0]?.total);
  };

  it("empties only the add-on's own tables", async () => {
    const response = await owner("POST", "/addons/shop/delete-data", { confirm: "DELETE" });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().emptied).toEqual(["shop_extras_notes"]);
    expect(await count("shop_extras_notes")).toBe(0);
    expect(await count("shop_customers")).toBe(1);
    expect(await count("users")).toBe(1);
  });

  it("never exports Lintel's own tables as the add-on's", async () => {
    const data = (await owner("GET", "/addons/shop/export")).json();
    expect(Object.keys(data.tables)).toEqual(["shop_extras_notes"]);
    const table = await owner("GET", "/addons/shop/export?format=csv&table=users");
    expect(table.statusCode).toBe(404);
  });

  it("doesn't list Lintel's own tables among what the add-on keeps", async () => {
    const details = (await owner("GET", "/addons/shop/details")).json();
    expect(details.stores.undeclared).toEqual([]);
    expect(details.stores.tables.map((table: { name: string }) => table.name)).toEqual([
      "shop_extras_notes",
    ]);
  });
});
