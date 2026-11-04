import { expect, it } from "vitest";
import { blueprintsTable } from "../blueprints/blueprints.table.js";
import { collectionsTable } from "../collections/collections.table.js";
import type { Database } from "../database/client.js";
import { tableFor } from "../database/dialect/mysql-tables.js";
import { insertReturning } from "../database/dialect/writes.js";
import { addTestEntry, describeOnEveryDatabase, findEntryRow } from "../testing/every-database.js";
import { listFieldValues, replaceFieldValue } from "./field-changes.repository.js";

async function addCollection(database: Database, handle: string) {
  const [blueprint] = await insertReturning(database, tableFor(database, blueprintsTable), {
    handle,
    name: handle,
    kind: "entry",
  });
  if (!blueprint) throw new Error("The test blueprint was not saved.");
  const [collection] = await insertReturning(database, tableFor(database, collectionsTable), {
    handle,
    name: handle,
    blueprintId: blueprint.id,
  });
  if (!collection) throw new Error("The test collection was not saved.");
  return { blueprintId: blueprint.id, collectionId: collection.id };
}

describeOnEveryDatabase("Field changes", (handle) => {
  it("lists each stored value as the JSON it is", async () => {
    const { database } = handle;
    const { blueprintId, collectionId } = await addCollection(database, "news");
    const values = ['He said "hello" to Zoë', 12.5, true, null, ["a", 1], { nested: { deep: 1 } }];
    const expected = [];
    for (const [place, price] of values.entries()) {
      const entry = await addTestEntry(database, {
        collectionId,
        slug: `entry-${place}`,
        data: { price },
      });
      expected.push({ entryId: entry.id, value: price });
    }

    const rows = await listFieldValues(database, blueprintId, "price");

    expect(rows).toHaveLength(expected.length);
    expect(rows).toEqual(expect.arrayContaining(expected));
  });

  it("leaves out entries without the field, and other blueprints' entries", async () => {
    const { database } = handle;
    const news = await addCollection(database, "news");
    const events = await addCollection(database, "events");
    const held = await addTestEntry(database, {
      collectionId: news.collectionId,
      slug: "held",
      data: { price: 1 },
    });
    await addTestEntry(database, {
      collectionId: news.collectionId,
      slug: "empty",
      data: { title: "No price" },
    });
    await addTestEntry(database, {
      collectionId: news.collectionId,
      slug: "published-only",
      data: {},
      publishedData: { price: 3 },
    });
    await addTestEntry(database, {
      collectionId: events.collectionId,
      slug: "other",
      data: { price: 2 },
    });

    expect(await listFieldValues(database, news.blueprintId, "price")).toEqual([
      { entryId: held.id, value: 1 },
    ]);
  });

  it("finds a field by a handle that needs quoting in a path", async () => {
    const { database } = handle;
    const { blueprintId, collectionId } = await addCollection(database, "news");
    const entry = await addTestEntry(database, { collectionId, data: { "sale-price.gbp": 5 } });
    expect(await listFieldValues(database, blueprintId, "sale-price.gbp")).toEqual([
      { entryId: entry.id, value: 5 },
    ]);
  });

  it("replaces the saved value and the published one, keeping the other fields", async () => {
    const { database } = handle;
    const entry = await addTestEntry(database, {
      data: { title: "Saved", price: "10" },
      publishedData: { title: "Live", price: "9" },
    });
    const price = { amount: 10, note: 'a "quote"' };

    await replaceFieldValue(database, [entry.id], "price", price);

    const row = await findEntryRow(database, entry.id);
    expect(row?.data).toEqual({ title: "Saved", price });
    expect(row?.publishedData).toEqual({ title: "Live", price });
  });

  it("stores plain values, a list and a JSON null", async () => {
    const { database } = handle;
    for (const [place, value] of [12.5, true, "text", ["a", "b"], null].entries()) {
      const entry = await addTestEntry(database, { slug: `entry-${place}`, data: { price: 1 } });
      await replaceFieldValue(database, [entry.id], "price", value);
      expect((await findEntryRow(database, entry.id))?.data).toEqual({ price: value });
    }
  });

  it("adds nothing to published values that don't hold the field", async () => {
    const { database } = handle;
    const neverPublished = await addTestEntry(database, { slug: "draft", data: { price: 1 } });
    const publishedWithout = await addTestEntry(database, {
      slug: "older",
      data: { price: 1 },
      publishedData: { title: "Live" },
    });

    await replaceFieldValue(database, [neverPublished.id, publishedWithout.id], "price", 2);

    const draft = await findEntryRow(database, neverPublished.id);
    expect(draft?.data).toEqual({ price: 2 });
    expect(draft?.publishedData).toBeNull();
    const older = await findEntryRow(database, publishedWithout.id);
    expect(older?.data).toEqual({ price: 2 });
    expect(older?.publishedData).toEqual({ title: "Live" });
  });

  it("changes only the entries named, and counts as a new version", async () => {
    const { database } = handle;
    const chosen = await addTestEntry(database, { slug: "chosen", data: { price: 1 } });
    const other = await addTestEntry(database, { slug: "other", data: { price: 1 } });

    await replaceFieldValue(database, [chosen.id], "price", 2);

    const row = await findEntryRow(database, chosen.id);
    expect(row?.version).toBe(chosen.version + 1);
    const untouched = await findEntryRow(database, other.id);
    expect(untouched?.data).toEqual({ price: 1 });
    expect(untouched?.version).toBe(other.version);
  });

  it("does nothing for no entries", async () => {
    const { database } = handle;
    const entry = await addTestEntry(database, { data: { price: 1 } });
    await replaceFieldValue(database, [], "price", 2);
    expect((await findEntryRow(database, entry.id))?.data).toEqual({ price: 1 });
  });
});
