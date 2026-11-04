import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterEach, expect, it } from "vitest";
import type { Database } from "../database/client.js";
import { tableFor } from "../database/dialect/mysql-tables.js";
import { insertReturning } from "../database/dialect/writes.js";
import { entriesTable, revisionsTable } from "../entries/entries.table.js";
import { rolesTable, userRolesTable } from "../roles/roles.table.js";
import { sitesTable } from "../sites/sites.table.js";
import {
  addTestEntry,
  addTestUser,
  describeOnEveryDatabase,
  findEntryRow,
} from "../testing/every-database.js";
import { usersTable } from "../users/users.table.js";
import {
  countRows,
  emptyTables,
  fillInColumns,
  insertAllRows,
  readAllRows,
  type TableRow,
  withForeignKeysAtEase,
} from "./database-snapshot.repository.js";
import {
  emptyMysqlTables,
  fillInMysqlColumns,
  insertAllMysqlRows,
  readAllMysqlRows,
} from "./mysql-snapshot.repository.js";

const noon = new Date("2026-11-04T12:00:00.125Z");
const later = new Date("2026-11-04T13:00:00.125Z");

/** An add-on's table, known here only by name, with a column of each kind that needs care. */
const LEDGER = "stamps_ledger";
const LEDGER_COLUMNS = ["id", "seal", "active", "stamped_at", "details", "note", "total"];

async function addLedgerTable(database: Database) {
  await database.execute(
    sql`create table stamps_ledger (id varchar(64) primary key, seal blob, active tinyint(1),
        stamped_at datetime(3), details json, note longtext, total integer)`,
  );
}

function byId(rows: readonly TableRow[]): TableRow[] {
  return [...rows].sort((first, second) => String(first.id).localeCompare(String(second.id)));
}

describeOnEveryDatabase("MySQL snapshots", (handle) => {
  const onMysql = it.skipIf(handle.name === "built-in");

  afterEach(async () => {
    await handle.database.execute(sql`drop table if exists stamps_ledger`);
  });

  onMysql("reads a schema table as the JSON rows a backup holds", async () => {
    const { database } = handle;
    const siteId = randomUUID();
    const [role] = await insertReturning(database, tableFor(database, rolesTable), {
      handle: "limited",
      name: "Editor",
      permissions: ["entries.read"],
      siteIds: [siteId],
      requiresTwoFactor: true,
      createdAt: noon,
      updatedAt: later,
    });

    const rows = await readAllMysqlRows(database, rolesTable);

    expect(rows).toEqual([
      {
        id: role?.id,
        tenant_id: "default",
        handle: "limited",
        name: "Editor",
        description: "",
        is_built_in: false,
        requires_two_factor: true,
        permissions: ["entries.read"],
        site_ids: [siteId],
        created_at: noon.toISOString(),
        updated_at: later.toISOString(),
      },
    ]);
    expect(await readAllRows(database, rolesTable)).toEqual(rows);
  });

  onMysql(
    "writes and reads an add-on's table, every kind of value as a backup has it",
    async () => {
      const { database } = handle;
      await addLedgerTable(database);
      const rows = [
        {
          id: "a",
          seal: "\\xdeadbeef00",
          active: true,
          stamped_at: noon.toISOString(),
          details: { level: 2, tags: ["gold"], nested: { on: false, none: null } },
          note: "Zoë’s “note”",
          total: 3,
        },
        {
          id: "b",
          seal: "\\x",
          active: false,
          stamped_at: "2026-11-04T13:00:00.125+01:00",
          details: [1, "two", true],
          note: '{"not":"json here"}',
          total: 0,
        },
        {
          id: "c",
          seal: null,
          active: null,
          stamped_at: null,
          details: null,
          note: null,
          total: null,
        },
        { id: "d", seal: null, active: null, stamped_at: null, details: 5, note: "", total: null },
        {
          id: "e",
          seal: null,
          active: null,
          stamped_at: null,
          details: "plain words",
          note: null,
          total: null,
        },
      ];

      await insertAllMysqlRows(database, LEDGER, rows, LEDGER_COLUMNS);

      const read = byId(await readAllMysqlRows(database, LEDGER));
      expect(read).toEqual(
        rows.map((row) => (row.id === "b" ? { ...row, stamped_at: noon.toISOString() } : row)),
      );
      expect(byId(await readAllRows(database, LEDGER))).toEqual(read);
    },
  );

  onMysql("writes an add-on's rows through insertAllRows, in several inserts", async () => {
    const { database } = handle;
    await addLedgerTable(database);
    const rows = Array.from({ length: 205 }, (_, index) => ({
      id: `row-${index}`,
      stamped_at: noon.toISOString(),
      total: index,
    }));

    await insertAllRows(database, LEDGER, rows);

    expect(await countRows(database, LEDGER)).toBe(205);
    const read = await readAllMysqlRows(database, LEDGER);
    expect(read.find((row) => row.id === "row-204")).toMatchObject({
      stamped_at: noon.toISOString(),
      total: 204,
      seal: null,
    });
  });

  onMysql("reads a long text column with a binary collation as plain text", async () => {
    const { database } = handle;
    await database.execute(
      sql`create table stamps_ledger (id varchar(64) primary key,
          note longtext character set utf8mb4 collate utf8mb4_bin)`,
    );
    await database.execute(sql`insert into stamps_ledger values ('a', 'Plain words')`);

    expect(await readAllMysqlRows(database, LEDGER)).toEqual([{ id: "a", note: "Plain words" }]);
  });

  onMysql("empties tables and those of Lintel's that point at them", async () => {
    const { database } = handle;
    await addLedgerTable(database);
    await insertAllMysqlRows(database, LEDGER, [{ id: "a" }], ["id"]);
    const parent = await addTestEntry(database);
    await addTestEntry(database, { slug: "child", parentId: parent.id });
    await insertReturning(database, tableFor(database, revisionsTable), {
      entryId: parent.id,
      data: {},
    });

    await database.transaction((transaction) =>
      withForeignKeysAtEase(transaction, () => emptyMysqlTables(transaction, ["entries", LEDGER])),
    );

    expect(await countRows(database, entriesTable)).toBe(0);
    expect(await countRows(database, revisionsTable)).toBe(0);
    expect(await countRows(database, LEDGER)).toBe(0);
    expect(await countRows(database, sitesTable)).toBe(1);
  });

  onMysql("leaves other tables alone, and does nothing with no names", async () => {
    const { database } = handle;
    await addLedgerTable(database);
    await insertAllMysqlRows(database, LEDGER, [{ id: "a" }], ["id"]);
    await addTestUser(database);

    await emptyMysqlTables(database, []);
    await emptyMysqlTables(database, [LEDGER]);

    expect(await countRows(database, LEDGER)).toBe(0);
    expect(await countRows(database, usersTable)).toBe(1);
  });

  onMysql("writes the named columns of a schema table, in several inserts", async () => {
    const { database } = handle;
    const ids = Array.from({ length: 205 }, () => randomUUID());
    const rows = ids.map((id, index) => ({
      id,
      email: `person-${index}@example.com`,
      name: "Ada",
      status: "deactivated",
      deactivated_at: noon.toISOString(),
      password_hash: "left out",
    }));

    await insertAllMysqlRows(database, usersTable, rows, [
      "id",
      "email",
      "name",
      "deactivated_at",
      "no_such_column",
      "last_signed_in_at",
    ]);

    expect(await countRows(database, usersTable)).toBe(205);
    const users = tableFor(database, usersTable);
    const [user] = await database
      .select()
      .from(users)
      .where(eq(users.id, ids[204] ?? ""));
    expect(user).toMatchObject({
      email: "person-204@example.com",
      status: "active",
      passwordHash: null,
      deactivatedAt: noon,
      lastSignedInAt: null,
    });
  });

  onMysql("fills in columns row by row, leaving rows without them alone", async () => {
    const { database } = handle;
    const first = await addTestEntry(database, { slug: "first", publishedData: { title: "Old" } });
    const second = await addTestEntry(database, {
      slug: "second",
      publishedData: { title: "Kept" },
    });

    await fillInMysqlColumns(
      database,
      entriesTable,
      [
        {
          id: first.id,
          parent_id: second.id,
          published_data: { title: "New", list: [1] },
          scheduled_for: "2026-11-04T13:00:00.125+01:00",
          no_such_column: "ignored",
        },
        { id: second.id },
        { id: randomUUID(), published_data: { title: "Nobody" } },
      ],
      ["parent_id", "published_data", "scheduled_for", "no_such_column"],
    );

    expect(await findEntryRow(database, first.id)).toMatchObject({
      slug: "first",
      parentId: second.id,
      publishedData: { title: "New", list: [1] },
      scheduledFor: noon,
    });
    expect(await findEntryRow(database, second.id)).toMatchObject({
      parentId: null,
      publishedData: { title: "Kept" },
      scheduledFor: null,
    });
  });

  onMysql("fills in a null, as a backup can hold one", async () => {
    const { database } = handle;
    const entry = await addTestEntry(database, { publishedData: { title: "Old" } });

    await fillInColumns(
      database,
      entriesTable,
      [{ id: entry.id, published_data: null, scheduled_for: null }],
      ["published_data", "scheduled_for"],
    );

    expect((await findEntryRow(database, entry.id))?.publishedData).toBeNull();
  });

  onMysql("refuses to fill in a table with no id column", async () => {
    const { database } = handle;
    await expect(
      fillInMysqlColumns(database, userRolesTable, [{ user_id: randomUUID() }], ["user_id"]),
    ).rejects.toThrow("user_roles has no id column.");
  });

  onMysql("goes through the same code when called the ordinary way", async () => {
    const { database } = handle;
    await addLedgerTable(database);
    await insertAllRows(database, LEDGER, [{ id: "a", active: true }]);

    await database.transaction((transaction) =>
      withForeignKeysAtEase(transaction, () => emptyTables(transaction, [LEDGER])),
    );

    expect(await readAllMysqlRows(database, LEDGER)).toEqual([]);
  });
});
