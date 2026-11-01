import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MIGRATIONS_FOLDER } from "../database/client.js";
import * as schema from "../database/schema.js";
import { deliverGlobalSet } from "../globals/globals-delivery.service.js";
import { deliverNavigation } from "../navigation/navigation-delivery.service.js";
import { listSites } from "./site-management.service.js";

/** The last migration before sites had their own menus and global values. */
const BEFORE_MULTISITE = "0009_drop_revision_actions";

/**
 * An install from before multi-site: migrated up to BEFORE_MULTISITE, given some content,
 * then brought up to date the way a server start does. Nothing about it should change.
 */
describe("moving an install to multi-site", () => {
  let folder: string;
  let client: PGlite;
  let database: ReturnType<typeof drizzle<typeof schema>>;

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "lintel-multisite-migration-"));
    await cp(MIGRATIONS_FOLDER, folder, { recursive: true });
    const journalFile = join(folder, "meta", "_journal.json");
    const journal = JSON.parse(await readFile(journalFile, "utf8")) as {
      entries: { tag: string }[];
    };
    const last = journal.entries.findIndex((entry) => entry.tag === BEFORE_MULTISITE);
    await writeFile(
      journalFile,
      JSON.stringify({ ...journal, entries: journal.entries.slice(0, last + 1) }),
    );

    client = new PGlite();
    database = drizzle(client, { schema });
    await migrate(database, { migrationsFolder: folder });
    // A fresh database runs every migration, which can take a while on a busy machine.
  }, 60_000);

  afterEach(async () => {
    await client.close();
    await rm(folder, { recursive: true, force: true });
  });

  async function addLegacyContent() {
    await database.execute(sql`
      insert into navigations (handle, name, items)
      values ('main', 'Main menu', '[{"id":"5b0e1c52-3f4a-4c55-9d2e-6c1f0a7b8e91","label":"Shop","url":"/shop","entryId":null,"newTab":false,"children":[]}]')
    `);
    await database.execute(sql`
      insert into global_sets (handle, name, fields)
      values ('footer', 'Footer', '[{"handle":"note","label":"Note","type":"text","required":false,"helpText":"","options":{}}]')
    `);
    await database.execute(sql`
      insert into global_values (global_set_id, locale, data)
      select id, 'en-GB', '{"note":"Made in Leeds"}' from global_sets where handle = 'footer'
    `);
    await database.execute(
      sql`insert into roles (handle, name, permissions) values ('editor', 'Editor', '{entries:*}')`,
    );
  }

  it("gives existing menus and global values to the default site, made if it was missing", async () => {
    await addLegacyContent();

    await migrate(database, { migrationsFolder: MIGRATIONS_FOLDER });

    const sites = await database.execute<{ id: string; handle: string; hostnames: string[] }>(
      sql`select id, handle, hostnames from sites`,
    );
    expect(sites.rows).toEqual([{ id: expect.any(String), handle: "default", hostnames: [] }]);
    const defaultSiteId = sites.rows[0]?.id;
    const owners = await database.execute<{ site_id: string }>(
      sql`select site_id from navigations union all select site_id from global_values`,
    );
    expect(owners.rows).toEqual([{ site_id: defaultSiteId }, { site_id: defaultSiteId }]);
    const roles = await database.execute<{ site_ids: string[] | null }>(
      sql`select site_ids from roles`,
    );
    expect(roles.rows).toEqual([{ site_ids: null }]);
  });

  it("keeps serving the same menus and globals, with no site named", async () => {
    await addLegacyContent();
    await migrate(database, { migrationsFolder: MIGRATIONS_FOLDER });

    const menu = await deliverNavigation(database, "main", undefined);
    const footer = await deliverGlobalSet(database, "footer", undefined, {
      findAssetsByIds: async () => new Map(),
    });

    expect(menu).toMatchObject({ locale: "en-GB", items: [{ label: "Shop", url: "/shop" }] });
    expect(footer.data).toEqual({ note: "Made in Leeds" });
  });

  it("uses the site an install already had, keeping its domain", async () => {
    await database.execute(sql`
      insert into sites (handle, name, domain, locale) values ('default', 'Corner Bakery', 'cornerbakery.example', 'en-GB')
    `);
    await addLegacyContent();

    await migrate(database, { migrationsFolder: MIGRATIONS_FOLDER });

    const { sites } = await listSites(database);
    expect(sites).toMatchObject([
      {
        handle: "default",
        name: "Corner Bakery",
        isDefault: true,
        hostnames: ["cornerbakery.example"],
      },
    ]);
  });

  it("migrates an install with nothing in it", async () => {
    await migrate(database, { migrationsFolder: MIGRATIONS_FOLDER });

    const sites = await database.execute(sql`select id from sites`);
    expect(sites.rows).toEqual([]);
    expect((await listSites(database)).sites).toHaveLength(1);
  });
});
