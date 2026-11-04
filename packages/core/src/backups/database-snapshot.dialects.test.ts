import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { afterEach, expect, it } from "vitest";
import { marketsTable } from "../commerce/markets/markets.table.js";
import type { Database } from "../database/client.js";
import { tableFor } from "../database/dialect/mysql-tables.js";
import { readRawRows } from "../database/dialect/raw-queries.js";
import { insertReturning } from "../database/dialect/writes.js";
import { entriesTable, revisionsTable } from "../entries/entries.table.js";
import { rolesTable } from "../roles/roles.table.js";
import { sessionsTable } from "../sessions/sessions.table.js";
import { settingsTable } from "../settings/settings.table.js";
import { sitesTable } from "../sites/sites.table.js";
import {
  addTestEntry,
  addTestUser,
  describeOnEveryDatabase,
  findEntryRow,
} from "../testing/every-database.js";
import { usersTable } from "../users/users.table.js";
import { backupsTable } from "./backups.table.js";
import {
  countRows,
  emptyTables,
  fillInColumns,
  findExistingTables,
  insertAllRows,
  readAllRows,
  readAllSettings,
  replaceAllSettings,
  rowsOf,
  type SnapshotTable,
  type TableRow,
  withForeignKeysAtEase,
} from "./database-snapshot.repository.js";

const noon = new Date("2026-11-04T12:00:00.125Z");
const later = new Date("2026-11-04T13:00:00.125Z");

/** Tables an add-on brings, known here only by name. */
const CARDS = "stamps_cards";
const OWNERS = "stamps_owners";

async function dropAddonTables(database: Database) {
  await database.execute(sql`drop view if exists stamps_view`);
  await database.execute(sql`drop table if exists stamps_cards`);
  await database.execute(sql`drop table if exists stamps_owners`);
}

async function addCardsTable(database: Database) {
  await database.execute(
    sql`create table stamps_cards (id varchar(64) primary key, owner_email text not null,
        stamps integer not null, active boolean not null, details json)`,
  );
}

/** Two add-on tables, one pointing at the other. */
async function addLinkedTables(database: Database) {
  await database.execute(sql`create table stamps_owners (id varchar(64) primary key)`);
  await database.execute(
    sql`create table stamps_cards (id varchar(64) primary key, owner_id varchar(64) not null,
        foreign key (owner_id) references stamps_owners (id))`,
  );
}

function byId(rows: readonly TableRow[]): TableRow[] {
  return [...rows].sort((first, second) => String(first.id).localeCompare(String(second.id)));
}

function rowWithId(rows: readonly TableRow[], id: string): TableRow {
  const row = rows.find((candidate) => candidate.id === id);
  if (!row) throw new Error(`No row with the id ${id}.`);
  return row;
}

/** A moment as a number, as the two kinds of database write the same time differently. */
function timeOf(value: unknown): number {
  return new Date(String(value)).getTime();
}

/** What a restore does with one table. */
function restore(
  database: Database,
  table: SnapshotTable,
  rows: readonly TableRow[],
  columnsLeftEmpty: readonly string[] = [],
) {
  return database.transaction((transaction) =>
    withForeignKeysAtEase(transaction, async () => {
      await emptyTables(transaction, [table]);
      await insertAllRows(transaction, table, rows, columnsLeftEmpty);
    }),
  );
}

async function addRole(database: Database, handle: string, siteIds: string[] | null) {
  const [role] = await insertReturning(database, tableFor(database, rolesTable), {
    handle,
    name: "Editor",
    permissions: ["entries.read", "entries.write"],
    siteIds,
    createdAt: noon,
  });
  if (!role) throw new Error("The test role was not saved.");
  return role;
}

function selectAll(database: Database, table: PgTable) {
  return database.select().from(tableFor(database, table));
}

describeOnEveryDatabase("Database snapshots", (handle) => {
  afterEach(() => dropAddonTables(handle.database));

  it("says which of these tables are there, in the order asked, without views", async () => {
    const { database } = handle;
    await addCardsTable(database);
    await database.execute(sql`create view stamps_view as select 1 as one`);

    const found = await findExistingTables(database, [
      "stamps_view",
      "users",
      "no_such_table",
      CARDS,
      "entries",
    ]);

    expect(found).toEqual(["users", CARDS, "entries"]);
    expect(await findExistingTables(database, [])).toEqual([]);
  });

  it("reads rows with database column names, lists, nulls and times intact", async () => {
    const { database } = handle;
    const siteId = randomUUID();
    const limited = await addRole(database, "limited", [siteId]);
    const everywhere = await addRole(database, "everywhere", null);

    const rows = await readAllRows(database, rolesTable);

    expect(rows).toHaveLength(2);
    const row = rowWithId(rows, limited.id);
    expect(row).toMatchObject({
      tenant_id: "default",
      handle: "limited",
      description: "",
      is_built_in: false,
      requires_two_factor: false,
      permissions: ["entries.read", "entries.write"],
      site_ids: [siteId],
    });
    expect(timeOf(row.created_at)).toBe(noon.getTime());
    expect(row).not.toHaveProperty("tenantId");
    expect(rowWithId(rows, everywhere.id).site_ids).toBeNull();
    expect(await readAllRows(database, sessionsTable)).toEqual([]);
  });

  it("reads big numbers, fractions and JSON as they are", async () => {
    const { database } = handle;
    await insertReturning(database, tableFor(database, backupsTable), {
      filename: "a.zip",
      trigger: "manual",
      size: 5_000_000_000,
      contents: { tables: { users: 2 }, files: 3 } as never,
    });
    await insertReturning(database, tableFor(database, marketsTable), {
      name: "Europe",
      handle: "europe",
      currency: "EUR",
      countries: ["FR", "DE"],
      exchangeRate: 1.25,
      paymentProvider: null,
    });

    const [backup] = await readAllRows(database, backupsTable);
    expect(backup).toMatchObject({
      size: 5_000_000_000,
      contents: { tables: { users: 2 }, files: 3 },
      checksum: null,
      completed_at: null,
    });
    const [market] = await readAllRows(database, marketsTable);
    expect(market).toMatchObject({
      countries: ["FR", "DE"],
      exchange_rate: 1.25,
      is_primary: false,
      prices_include_tax: true,
      payment_provider: null,
    });
  });

  it("writes an add-on's table and reads it back, knowing it only by name", async () => {
    const { database } = handle;
    await addCardsTable(database);
    const rows = [
      {
        id: "a",
        owner_email: "ada@example.com",
        stamps: 3,
        active: true,
        details: { level: 2, tags: ["gold"], nested: { on: false } },
      },
      { id: "b", owner_email: "grace@example.com", stamps: 0, active: false, details: null },
    ];

    await insertAllRows(database, CARDS, rows);

    expect(byId(await readAllRows(database, CARDS))).toEqual(rows);
    expect(await countRows(database, CARDS)).toBe(2);
  });

  it("writes only the columns an add-on's table has and the rows hold", async () => {
    const { database } = handle;
    await addCardsTable(database);

    await insertAllRows(
      database,
      CARDS,
      [
        {
          id: "a",
          owner_email: "ada@example.com",
          stamps: 3,
          active: true,
          details: { level: 2 },
          removed_since: "x",
        },
      ],
      ["details"],
    );

    expect(await readAllRows(database, CARDS)).toEqual([
      { id: "a", owner_email: "ada@example.com", stamps: 3, active: true, details: null },
    ]);
  });

  it("writes an add-on's rows however many there are", async () => {
    const { database } = handle;
    await addCardsTable(database);
    const rows = Array.from({ length: 230 }, (_, index) => ({
      id: `card-${index}`,
      owner_email: "ada@example.com",
      stamps: index,
      active: index % 2 === 0,
      details: null,
    }));

    await insertAllRows(database, CARDS, rows);

    expect(await countRows(database, CARDS)).toBe(230);
    expect(rowWithId(await readAllRows(database, CARDS), "card-229")).toMatchObject({
      stamps: 229,
      active: false,
    });
  });

  it("counts rows of a schema table and an empty one", async () => {
    const { database } = handle;
    expect(await countRows(database, usersTable)).toBe(0);
    await addTestUser(database);
    await addTestUser(database, "grace@example.com");
    expect(await countRows(database, usersTable)).toBe(2);
    expect(await countRows(database, "users")).toBe(2);
  });

  it("empties a table and all that points at it, and nothing else", async () => {
    const { database } = handle;
    const entry = await addTestEntry(database);
    const child = await addTestEntry(database, { slug: "child", parentId: entry.id });
    await insertReturning(database, tableFor(database, revisionsTable), {
      entryId: child.id,
      data: {},
    });
    await replaceAllSettings(database, { title: "Hello" });

    await database.transaction((transaction) =>
      withForeignKeysAtEase(transaction, () => emptyTables(transaction, [entriesTable])),
    );

    expect(await countRows(database, entriesTable)).toBe(0);
    expect(await countRows(database, revisionsTable)).toBe(0);
    expect(await countRows(database, sitesTable)).toBe(1);
    expect(await readAllSettings(database)).toEqual({ title: "Hello" });
  });

  it("follows what points at a table however indirectly", async () => {
    const { database } = handle;
    const user = await addTestUser(database);
    await addTestEntry(database, { createdBy: user.id });
    await insertReturning(database, tableFor(database, sessionsTable), {
      userId: user.id,
      tokenHash: "token",
      expiresAt: later,
    });

    await database.transaction((transaction) =>
      withForeignKeysAtEase(transaction, () => emptyTables(transaction, [usersTable])),
    );

    expect(await countRows(database, usersTable)).toBe(0);
    expect(await countRows(database, sessionsTable)).toBe(0);
    expect(await countRows(database, entriesTable)).toBe(0);
    expect(await countRows(database, sitesTable)).toBe(1);
  });

  it("empties schema tables and add-ons' together", async () => {
    const { database } = handle;
    await addCardsTable(database);
    await addTestUser(database);
    await insertAllRows(database, CARDS, [
      { id: "a", owner_email: "ada@example.com", stamps: 1, active: true, details: null },
    ]);

    await database.transaction((transaction) =>
      withForeignKeysAtEase(transaction, () => emptyTables(transaction, [usersTable, CARDS])),
    );

    expect(await countRows(database, usersTable)).toBe(0);
    expect(await countRows(database, CARDS)).toBe(0);
  });

  it("empties add-on tables pointing at each other during a restore", async () => {
    const { database } = handle;
    await addLinkedTables(database);
    await insertAllRows(database, OWNERS, [{ id: "ada" }]);
    await insertAllRows(database, CARDS, [{ id: "a", owner_id: "ada" }]);

    await database.transaction((transaction) =>
      withForeignKeysAtEase(transaction, () => emptyTables(transaction, [OWNERS, CARDS])),
    );

    expect(await countRows(database, OWNERS)).toBe(0);
    expect(await countRows(database, CARDS)).toBe(0);
  });

  it("empties add-on tables pointing at each other outside a restore", async () => {
    const { database } = handle;
    await addLinkedTables(database);
    await insertAllRows(database, OWNERS, [{ id: "ada" }]);
    await insertAllRows(database, CARDS, [{ id: "a", owner_id: "ada" }]);

    await emptyTables(database, [OWNERS, CARDS]);

    expect(await countRows(database, OWNERS)).toBe(0);
    expect(await countRows(database, CARDS)).toBe(0);
  });

  it("puts a table's rows back exactly as they were", async () => {
    const { database } = handle;
    await addRole(database, "limited", [randomUUID()]);
    await addRole(database, "everywhere", null);
    await insertReturning(database, tableFor(database, backupsTable), {
      filename: "a.zip",
      trigger: "manual",
      size: 5_000_000_000,
      contents: { tables: { users: 2 } } as never,
      completedAt: noon,
    });
    await insertReturning(database, tableFor(database, backupsTable), {
      filename: "b.zip",
      trigger: "manual",
    });
    await insertReturning(database, tableFor(database, usersTable), {
      email: "zoe@example.com",
      name: 'Zoë \\ "😀" O\'Neil',
      lastSignedInAt: noon,
    });

    for (const table of [rolesTable, backupsTable, usersTable]) {
      const before = await selectAll(database, table);
      await restore(database, table, await readAllRows(database, table));
      const after = await selectAll(database, table);
      expect(after).toHaveLength(before.length);
      expect(after).toEqual(expect.arrayContaining(before));
    }
  });

  it("puts a page back before its parent when a restore asks it to", async () => {
    const { database } = handle;
    const parent = await addTestEntry(database, {
      slug: "parent",
      data: { title: "Parent", blocks: [{ on: true }] },
      publishedData: { title: "Live" },
      publishedAt: noon,
    });
    const child = await addTestEntry(database, { slug: "child", parentId: parent.id });
    const rows = await readAllRows(database, entriesTable);
    const childFirst = [rowWithId(rows, child.id), rowWithId(rows, parent.id)];

    await restore(database, entriesTable, childFirst);

    expect(await findEntryRow(database, parent.id)).toEqual(parent);
    expect(await findEntryRow(database, child.id)).toEqual(child);
  });

  it("does nothing with no rows, and leaves new columns to their defaults", async () => {
    const { database } = handle;
    await insertAllRows(database, usersTable, []);
    expect(await countRows(database, usersTable)).toBe(0);

    const id = randomUUID();
    await insertAllRows(database, usersTable, [
      { id, email: "ada@example.com", name: "Ada", column_from_long_ago: "dropped" },
    ]);

    const users = tableFor(database, usersTable);
    const [user] = await database.select().from(users).where(eq(users.id, id));
    expect(user).toMatchObject({
      tenantId: "default",
      status: "active",
      passwordHash: null,
      lastSignedInAt: null,
    });
    expect(user?.createdAt).toBeInstanceOf(Date);
  });

  it("reads times from a backup made on either kind of database", async () => {
    const { database } = handle;
    const [fromPostgres, fromMysql, inParis] = [randomUUID(), randomUUID(), randomUUID()];
    const person = { name: "Ada", updated_at: "2026-11-04T12:00:00.125Z" };
    await insertAllRows(database, usersTable, [
      {
        ...person,
        id: fromPostgres,
        email: "a@example.com",
        created_at: "2026-11-04T12:00:00.125+00:00",
      },
      {
        ...person,
        id: fromMysql,
        email: "b@example.com",
        created_at: "2026-11-04T12:00:00.125Z",
      },
      {
        ...person,
        id: inParis,
        email: "c@example.com",
        created_at: "2026-11-04T13:00:00.125+01:00",
      },
    ]);

    const users = await selectAll(database, usersTable);
    expect(users.map((user) => (user as { createdAt: Date }).createdAt)).toEqual([
      noon,
      noon,
      noon,
    ]);
  });

  it("leaves columns empty when told to, and fills them in afterwards by id", async () => {
    const { database } = handle;
    const parent = await addTestEntry(database, { slug: "parent" });
    const child = await addTestEntry(database, {
      slug: "child",
      parentId: parent.id,
      publishedData: { title: "Live", list: [1, 2] },
      scheduledFor: noon,
    });
    const rows = await readAllRows(database, entriesTable);
    const columns = ["parent_id", "published_data", "scheduled_for"];

    await restore(database, entriesTable, rows, columns);
    expect(await findEntryRow(database, child.id)).toMatchObject({
      parentId: null,
      publishedData: null,
      scheduledFor: null,
    });

    await database.transaction((transaction) =>
      withForeignKeysAtEase(transaction, () =>
        fillInColumns(transaction, entriesTable, rows, columns),
      ),
    );

    expect(await findEntryRow(database, child.id)).toMatchObject({
      slug: "child",
      parentId: parent.id,
      publishedData: { title: "Live", list: [1, 2] },
      scheduledFor: noon,
    });
    expect(await findEntryRow(database, parent.id)).toMatchObject({
      parentId: null,
      publishedData: null,
      scheduledFor: null,
    });
  });

  it("fills in nothing without rows, columns or a matching id", async () => {
    const { database } = handle;
    const user = await addTestUser(database);
    const users = tableFor(database, usersTable);
    const [before] = await database.select().from(users).where(eq(users.id, user.id));

    await fillInColumns(database, usersTable, [], ["name"]);
    await fillInColumns(database, usersTable, [{ id: user.id, name: "Changed" }], []);
    await fillInColumns(database, usersTable, [{ id: user.id, name: "Changed" }], ["status"]);
    await fillInColumns(database, usersTable, [{ id: randomUUID(), name: "Changed" }], ["name"]);

    expect(await database.select().from(users).where(eq(users.id, user.id))).toEqual([before]);
  });

  it("leaves a row's last-changed time and version alone when filling in", async () => {
    const { database } = handle;
    const entry = await addTestEntry(database, { updatedAt: noon });
    const rows = await readAllRows(database, entriesTable);

    await fillInColumns(database, entriesTable, rows, ["parent_id"]);

    expect(await findEntryRow(database, entry.id)).toMatchObject({
      updatedAt: noon,
      version: 1,
    });
  });

  it("reads and replaces settings, JSON of every kind included", async () => {
    const { database } = handle;
    expect(await readAllSettings(database)).toEqual({});
    const settings = {
      theme: { colour: "red", sizes: [1, 2], nested: { on: true, none: null } },
      title: "Zoë’s “site”",
      count: 3,
      fraction: 0.5,
      off: false,
      list: [],
    };

    await replaceAllSettings(database, settings);
    expect(await readAllSettings(database)).toEqual(settings);

    await replaceAllSettings(database, { title: "New" });
    expect(await readAllSettings(database)).toEqual({ title: "New" });
    expect(await countRows(database, settingsTable)).toBe(1);

    await replaceAllSettings(database, {});
    expect(await readAllSettings(database)).toEqual({});
  });

  // On the built-in database a JSON value that is text is parsed a second time when read.
  (handle.name === "built-in" ? it.fails : it)(
    "keeps a setting that is text looking like JSON as text",
    async () => {
      const { database } = handle;
      const settings = { digits: "42", looksLikeJson: '{"a":1}', word: "true" };

      await replaceAllSettings(database, settings);

      expect(await readAllSettings(database)).toEqual(settings);
    },
  );

  it("puts settings back inside a restore", async () => {
    const { database } = handle;
    await replaceAllSettings(database, { title: "Old", gone: true });

    await database.transaction((transaction) =>
      withForeignKeysAtEase(transaction, () =>
        replaceAllSettings(transaction, { title: "Restored" }),
      ),
    );

    expect(await readAllSettings(database)).toEqual({ title: "Restored" });
  });

  it("reads rows from whatever the driver gave back", async () => {
    const { database } = handle;
    await addTestUser(database);

    const found = await database.execute(sql`select email from users`);
    expect(rowsOf(found)).toEqual([{ email: "ada@example.com" }]);

    const nothing = await database.execute(sql`select email from users where email = 'nobody'`);
    expect(rowsOf(nothing)).toEqual([]);
  });

  it("gives back what a restore answers, and passes on what stops it", async () => {
    const { database } = handle;
    const answer = await database.transaction((transaction) =>
      withForeignKeysAtEase(transaction, async () => "restored"),
    );
    expect(answer).toBe("restored");

    await expect(
      database.transaction((transaction) =>
        withForeignKeysAtEase(transaction, async () => {
          await replaceAllSettings(transaction, { title: "Half way" });
          throw new Error("The archive is broken");
        }),
      ),
    ).rejects.toThrow("The archive is broken");
    expect(await readAllSettings(database)).toEqual({});
  });

  it.skipIf(handle.name === "built-in")(
    "turns foreign key checks off for the restore and on again, even when it fails",
    async () => {
      const { database } = handle;
      const checks = async (transaction: Parameters<typeof readRawRows>[0]) => {
        const [row] = await readRawRows(transaction, sql`select @@foreign_key_checks as checks`);
        return Number(row?.checks);
      };

      await database.transaction(async (transaction) => {
        expect(await checks(transaction)).toBe(1);
        await withForeignKeysAtEase(transaction, async () => {
          expect(await checks(transaction)).toBe(0);
        });
        expect(await checks(transaction)).toBe(1);

        await expect(
          withForeignKeysAtEase(transaction, async () => {
            throw new Error("The archive is broken");
          }),
        ).rejects.toThrow("The archive is broken");
        expect(await checks(transaction)).toBe(1);
      });
    },
  );
});
