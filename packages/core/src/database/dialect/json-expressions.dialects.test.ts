import { and, desc, eq, sql } from "drizzle-orm";
import { expect, it } from "vitest";
import { collectionsTable } from "../../collections/collections.table.js";
import { entriesTable } from "../../entries/entries.table.js";
import { addTestEntry, describeOnEveryDatabase } from "../../testing/every-database.js";
import {
  jsonHasKey,
  jsonIsObject,
  jsonKeyEquals,
  jsonKeyInQuery,
  jsonKeyListIncludes,
  jsonListHasItemLike,
  jsonLiteral,
  jsonObjectHoldsText,
  jsonOnlyKeys,
  jsonTextAt,
  jsonWithKey,
  jsonWithKeyRenamed,
  positionInList,
} from "./json-expressions.js";
import { isValueTooLong } from "../database-errors.js";
import { jsonText, orderNewestFirst } from "./expressions.js";
import { holdLockUntilTransactionEnds } from "./locks.js";
import { tableFor } from "./mysql-tables.js";
import { appliedMigrationsTable, currentSchema, measureTable, readRawRows } from "./raw-queries.js";
import { textSearch } from "./text-search.js";

const stored = {
  title: "Über uns",
  tags: ["Sale", "new"],
  count: 3,
  group: { label: "Opening hours", nested: { deep: true } },
  nothing: null,
  "odd key": "it's here",
};

describeOnEveryDatabase("JSON expressions", (handle) => {
  async function entry() {
    const { database } = handle;
    const entries = tableFor(database, entriesTable);
    const row = await addTestEntry(database, { data: stored });
    return { database, entries, id: row.id, data: entries.data };
  }

  it("reads through objects and lists", async () => {
    const { database, entries, data } = await entry();
    const [row] = await database
      .select({
        label: jsonTextAt(database, data, ["group", "label"]),
        second: jsonTextAt(database, data, ["tags", 1]),
        missing: jsonTextAt(database, data, ["group", "gone"]),
        nothing: jsonTextAt(database, data, ["nothing"]),
      })
      .from(entries);
    expect(row).toEqual({ label: "Opening hours", second: "new", missing: null, nothing: null });
  });

  it("tells a key that exists from one that doesn't, even when it holds null", async () => {
    const { database, entries, data } = await entry();
    const found = (key: string) =>
      database
        .select({ id: entries.id })
        .from(entries)
        .where(jsonHasKey(database, data, key));
    expect(await found("nothing")).toHaveLength(1);
    expect(await found("odd key")).toHaveLength(1);
    expect(await found("gone")).toEqual([]);
  });

  it("tells an object from a list and a plain value", async () => {
    const { database, entries, data } = await entry();
    const whereObject = (key: string) =>
      database
        .select({ id: entries.id })
        .from(entries)
        .where(jsonIsObject(database, jsonKeyInQuery(database, data, key)));
    expect(await whereObject("group")).toHaveLength(1);
    expect(await whereObject("tags")).toEqual([]);
    expect(await whereObject("count")).toEqual([]);
    expect(await whereObject("gone")).toEqual([]);
  });

  it("compares a key with a value of any kind", async () => {
    const { database, entries, data } = await entry();
    const matches = async (key: string, value: unknown) =>
      (
        await database
          .select({ id: entries.id })
          .from(entries)
          .where(jsonKeyEquals(database, data, key, value))
      ).length === 1;
    expect(await matches("title", "Über uns")).toBe(true);
    expect(await matches("title", "über uns")).toBe(false);
    expect(await matches("count", 3)).toBe(true);
    expect(await matches("count", "3")).toBe(false);
    expect(await matches("group", stored.group)).toBe(true);
    expect(await matches("gone", 1)).toBe(false);
  });

  it("looks in a list under a key", async () => {
    const { database, entries, data } = await entry();
    const has = (item: string) =>
      database
        .select({ id: entries.id })
        .from(entries)
        .where(jsonKeyListIncludes(database, data, "tags", item));
    expect(await has("new")).toHaveLength(1);
    expect(await has("old")).toEqual([]);
  });

  it("sets a key to text, numbers, lists and objects", async () => {
    const { database, entries, id, data } = await entry();
    for (const value of ["plain", 'with "quotes"', 7, [1, "two"], { a: { b: null } }, null]) {
      await database
        .update(entries)
        .set({ data: jsonWithKey(database, data, "count", jsonLiteral(database, value)) })
        .where(eq(entries.id, id));
      const [row] = await database.select({ data }).from(entries);
      expect(row?.data.count).toEqual(value);
    }
  });

  it("moves a value to another key, at the top and inside a group", async () => {
    const { database, entries, id, data } = await entry();
    await database
      .update(entries)
      .set({ data: jsonWithKeyRenamed(database, data, "title", "heading") })
      .where(eq(entries.id, id));
    const moved = jsonWithKeyRenamed(
      database,
      jsonKeyInQuery(database, data, "group"),
      "label",
      "name",
    );
    await database
      .update(entries)
      .set({ data: jsonWithKey(database, data, "group", moved) })
      .where(eq(entries.id, id));
    const [row] = await database.select({ data }).from(entries);
    expect(row?.data).toMatchObject({
      heading: "Über uns",
      group: { name: "Opening hours", nested: { deep: true } },
    });
    expect(row?.data).not.toHaveProperty("title");
    expect(row?.data.group).not.toHaveProperty("label");
  });

  it("selects just some keys, as an object", async () => {
    const { database, entries, data } = await entry();
    const [row] = await database
      .select({
        some: jsonOnlyKeys(database, data, ["title", "group", "gone"]),
        none: jsonOnlyKeys(database, data, []),
      })
      .from(entries);
    expect(row?.some).toMatchObject({ title: "Über uns", group: stored.group });
    expect(row?.some.gone ?? null).toBeNull();
    expect(row?.none).toEqual({});
  });

  it("finds a whole value at the top of an object, ignoring case and spaces", async () => {
    const { database, entries, data } = await entry();
    const holds = (text: string) =>
      database
        .select({ id: entries.id })
        .from(entries)
        .where(jsonObjectHoldsText(database, data, text));
    expect(await holds("  ÜBER UNS ")).toHaveLength(1);
    expect(await holds("Über")).toEqual([]);
    expect(await holds("Opening hours")).toEqual([]);
  });

  it("finds a whole value when that's the only condition on a join", async () => {
    const { database, entries, data } = await entry();
    const collections = tableFor(database, collectionsTable);
    const rows = await database
      .select({ id: entries.id, handle: collections.handle })
      .from(entries)
      .innerJoin(collections, eq(collections.id, entries.collectionId))
      .where(and(eq(entries.tenantId, "default"), jsonObjectHoldsText(database, data, "über uns")))
      .orderBy(desc(entries.createdAt));
    expect(rows).toHaveLength(1);
  });

  it("finds a list item by pattern, ignoring case", async () => {
    const { database, entries } = await entry();
    const tags = jsonKeyInQuery(database, entries.data, "tags");
    const matching = (pattern: string) =>
      database
        .select({ id: entries.id })
        .from(entries)
        .where(jsonListHasItemLike(database, tags, pattern));
    expect(await matching("%SAL%")).toHaveLength(1);
    expect(await matching("%old%")).toEqual([]);
  });

  it("orders rows by where their id comes in a list", async () => {
    const { database } = handle;
    const entries = tableFor(database, entriesTable);
    const first = await addTestEntry(database, { slug: "first" });
    const second = await addTestEntry(database, { slug: "second" });
    const rows = await database
      .select({ id: entries.id })
      .from(entries)
      .orderBy(positionInList(database, entries.id, [second.id, first.id]));
    expect(rows.map((row) => row.id)).toEqual([second.id, first.id]);
  });
});

describeOnEveryDatabase("Text search", (handle) => {
  it("finds words in titles, slugs and values, never in keys", async () => {
    const { database } = handle;
    const entries = tableFor(database, entriesTable);
    await addTestEntry(database, {
      slug: "opening-hours",
      data: { title: "Visit us", body: { text: "Fresh bread daily" } },
    });
    const search = (words: string[]) => {
      const { matches, rank } = textSearch(
        database,
        {
          title: sql`coalesce(${jsonText(database, entries.data, "title")}, '')`,
          slug: entries.slug,
          values: entries.data,
        },
        words,
      );
      return database
        .select({ id: entries.id, rank: sql<number>`${rank}` })
        .from(entries)
        .where(matches);
    };
    expect(await search(["opening"])).toHaveLength(1);
    expect(await search(["fresh", "dai"])).toHaveLength(1);
    expect(await search(["fresh", "cake"])).toEqual([]);
    expect(await search(["body"])).toEqual([]);
  });
});

describeOnEveryDatabase("Locks until a transaction ends", (handle) => {
  it("makes a second transaction wait for the first", async () => {
    const { database } = handle;
    const order: string[] = [];
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let locked: () => void = () => {};
    const first = new Promise<void>((resolve) => {
      locked = resolve;
    });

    const holder = database.transaction(async (transaction) => {
      await holdLockUntilTransactionEnds(transaction, "test:lock");
      locked();
      await held;
      order.push("first ends");
    });
    await first;
    const waiter = database.transaction(async (transaction) => {
      await holdLockUntilTransactionEnds(transaction, "test:lock");
      order.push("second has it");
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(order).toEqual([]);
    release();
    await Promise.all([holder, waiter]);
    expect(order).toEqual(["first ends", "second has it"]);
  });

  it("lets go when the transaction fails", async () => {
    const { database } = handle;
    await expect(
      database.transaction(async (transaction) => {
        await holdLockUntilTransactionEnds(transaction, 123);
        throw new Error("Gave up");
      }),
    ).rejects.toThrow("Gave up");
    await database.transaction((transaction) => holdLockUntilTransactionEnds(transaction, 123));
  });
});

describeOnEveryDatabase("Differences that show in results", (handle) => {
  it("puts nulls first in newest-first order, as Postgres does", async () => {
    const { database } = handle;
    const entries = tableFor(database, entriesTable);
    await addTestEntry(database, { slug: "old", publishedAt: new Date("2026-01-01T00:00:00Z") });
    await addTestEntry(database, { slug: "new", publishedAt: new Date("2026-02-01T00:00:00Z") });
    await addTestEntry(database, { slug: "none", publishedAt: null });
    const rows = await database
      .select({ slug: entries.slug })
      .from(entries)
      .orderBy(orderNewestFirst(database, entries.publishedAt));
    expect(rows.map((row) => row.slug)).toEqual(["none", "new", "old"]);
  });

  it.skipIf(handle.name === "built-in")("knows a value too long for a key", async () => {
    const failure = await addTestEntry(handle.database, { slug: "x".repeat(300) }).catch(
      (error: unknown) => error,
    );
    expect(isValueTooLong(failure)).toBe(true);
  });
});

describeOnEveryDatabase("Deadlocks", (handle) => {
  it.skipIf(handle.name === "built-in")("tries again when MySQL undoes a transaction", async () => {
    const { database } = handle;
    const entries = tableFor(database, entriesTable);
    const first = await addTestEntry(database, { slug: "first" });
    const second = await addTestEntry(database, { slug: "second" });
    let attempts = 0;
    let bothHoldOne: () => void = () => {};
    let holding = 0;
    const together = new Promise<void>((resolve) => {
      bothHoldOne = resolve;
    });

    /** Takes one row, waits for the other side to do the same, then wants the other row. */
    const crossing = (mine: string, theirs: string) =>
      database.transaction(async (transaction) => {
        attempts += 1;
        await transaction.update(entries).set({ sortOrder: 1 }).where(eq(entries.id, mine));
        holding += 1;
        if (holding === 2) bothHoldOne();
        await together;
        await transaction.update(entries).set({ sortOrder: 2 }).where(eq(entries.id, theirs));
      });

    await Promise.all([crossing(first.id, second.id), crossing(second.id, first.id)]);
    expect(attempts).toBe(3);
  });

  it.skipIf(handle.name === "built-in")(
    "tries again when the deadlock comes in a write nested in the transaction",
    async () => {
      const { database } = handle;
      const entries = tableFor(database, entriesTable);
      const first = await addTestEntry(database, { slug: "first" });
      const second = await addTestEntry(database, { slug: "second" });
      let attempts = 0;
      let bothHoldOne: () => void = () => {};
      let holding = 0;
      const together = new Promise<void>((resolve) => {
        bothHoldOne = resolve;
      });

      // As `insertReturning` does inside a service's transaction. The deadlock undoes the whole
      // transaction, savepoint and all, so rolling back to the savepoint fails with its own error.
      const crossing = (mine: string, theirs: string) =>
        database.transaction(async (transaction) => {
          attempts += 1;
          await transaction.update(entries).set({ sortOrder: 1 }).where(eq(entries.id, mine));
          holding += 1;
          if (holding === 2) bothHoldOne();
          await together;
          await transaction.transaction(async (nested) => {
            await nested.update(entries).set({ sortOrder: 2 }).where(eq(entries.id, theirs));
          });
        });

      await Promise.all([crossing(first.id, second.id), crossing(second.id, first.id)]);
      expect(attempts).toBe(3);
    },
  );
});

describeOnEveryDatabase("Raw queries", (handle) => {
  it("reads rows the same way on each driver", async () => {
    const { database } = handle;
    const [row] = await readRawRows(database, sql`select 1 + 1 as total`);
    expect(Number(row?.total)).toBe(2);
  });

  it("finds Drizzle's record of migrations", async () => {
    const { database } = handle;
    const [row] = await readRawRows(
      database,
      sql`select count(*) as total from ${appliedMigrationsTable(database)}`,
    );
    expect(Number(row?.total)).toBeGreaterThan(0);
  });

  it("names the schema tables are in, and measures one", async () => {
    const { database } = handle;
    const [row] = await readRawRows(database, sql`select ${currentSchema(database)} as name`);
    expect(row?.name).toBeTruthy();
    expect(await measureTable(database, "entries")).toBeGreaterThan(0);
  });
});
