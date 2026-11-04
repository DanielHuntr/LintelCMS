import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import { blueprintsTable } from "../blueprints/blueprints.table.js";
import { collectionsTable } from "../collections/collections.table.js";
import type { Database } from "../database/client.js";
import { tableFor } from "../database/dialect/mysql-tables.js";
import { insertReturning } from "../database/dialect/writes.js";
import { addTestEntry, describeOnEveryDatabase, findEntryRow } from "../testing/every-database.js";
import { revisionsTable } from "./entries.table.js";
import { moveFieldValues } from "./field-renames.repository.js";
import { insertRevision } from "./revisions.repository.js";

/*
 * Values are compared as parsed JSON with `toEqual`, which ignores the order of an object's
 * keys: where a moved key ends up is not part of what a rename promises.
 */

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

async function revisionData(database: Database, entryId: string) {
  const revisions = tableFor(database, revisionsTable);
  const rows = await database.select().from(revisions).where(eq(revisions.entryId, entryId));
  return rows.map((revision) => revision.data);
}

describeOnEveryDatabase("Field renames", (handle) => {
  it("moves saved values, published values and every revision", async () => {
    const { database } = handle;
    const { blueprintId, collectionId } = await addCollection(database, "news");
    const entry = await addTestEntry(database, {
      collectionId,
      data: { title: "Saved", intro: "Hello" },
      publishedData: { title: "Live", intro: "Hi" },
    });
    for (const intro of ["One", "Two"]) {
      await insertRevision(database, {
        entryId: entry.id,
        authorId: null,
        kind: "edited",
        data: { title: "Old", intro },
      });
    }

    await moveFieldValues(database, blueprintId, { from: "intro", to: "summary" });

    const row = await findEntryRow(database, entry.id);
    expect(row?.data).toEqual({ title: "Saved", summary: "Hello" });
    expect(row?.publishedData).toEqual({ title: "Live", summary: "Hi" });
    const revisions = await revisionData(database, entry.id);
    expect(revisions).toHaveLength(2);
    expect(revisions).toEqual(
      expect.arrayContaining([
        { title: "Old", summary: "One" },
        { title: "Old", summary: "Two" },
      ]),
    );
  });

  it("keeps each kind of value as it was", async () => {
    const { database } = handle;
    const { blueprintId, collectionId } = await addCollection(database, "news");
    const values = [12.5, true, null, ["a", { b: 1 }], { deep: { list: [1, 2] } }, 'a "quote" é'];
    const entryIds = [];
    for (const [place, value] of values.entries()) {
      const entry = await addTestEntry(database, {
        collectionId,
        slug: `entry-${place}`,
        data: { intro: value },
      });
      entryIds.push(entry.id);
    }

    await moveFieldValues(database, blueprintId, { from: "intro", to: "summary" });

    for (const [place, entryId] of entryIds.entries()) {
      expect((await findEntryRow(database, entryId))?.data).toEqual({ summary: values[place] });
    }
  });

  it("moves a value inside its group, leaving the rest of the group", async () => {
    const { database } = handle;
    const { blueprintId, collectionId } = await addCollection(database, "news");
    const entry = await addTestEntry(database, {
      collectionId,
      data: { title: "Saved", seo: { heading: "One", image: "a.png" }, heading: "Outside" },
      publishedData: { seo: { heading: "Two" } },
    });
    await insertRevision(database, {
      entryId: entry.id,
      authorId: null,
      kind: "published",
      data: { seo: { heading: "Three" } },
    });

    await moveFieldValues(database, blueprintId, { from: "heading", to: "title", within: "seo" });

    const row = await findEntryRow(database, entry.id);
    expect(row?.data).toEqual({
      title: "Saved",
      seo: { title: "One", image: "a.png" },
      heading: "Outside",
    });
    expect(row?.publishedData).toEqual({ seo: { title: "Two" } });
    expect(await revisionData(database, entry.id)).toEqual([{ seo: { title: "Three" } }]);
  });

  it("leaves a group that is missing, or isn't an object", async () => {
    const { database } = handle;
    const { blueprintId, collectionId } = await addCollection(database, "news");
    const held = [
      { title: "No group" },
      { seo: "plain text" },
      { seo: ["heading"] },
      { seo: null },
    ];
    const entries = [];
    for (const [place, data] of held.entries()) {
      entries.push(await addTestEntry(database, { collectionId, slug: `entry-${place}`, data }));
    }

    await moveFieldValues(database, blueprintId, { from: "heading", to: "title", within: "seo" });

    for (const [place, entry] of entries.entries()) {
      const row = await findEntryRow(database, entry.id);
      expect(row?.data).toEqual(held[place]);
      expect(row?.version).toBe(entry.version);
    }
  });

  it("changes only the values that hold the field", async () => {
    const { database } = handle;
    const { blueprintId, collectionId } = await addCollection(database, "news");
    const without = await addTestEntry(database, {
      collectionId,
      slug: "without",
      data: { title: "No intro" },
      publishedData: { title: "No intro" },
    });
    const draft = await addTestEntry(database, {
      collectionId,
      slug: "draft",
      data: { intro: "Saved" },
    });
    const publishedOnly = await addTestEntry(database, {
      collectionId,
      slug: "removed-since",
      data: { title: "Removed" },
      publishedData: { intro: "Live" },
    });

    await moveFieldValues(database, blueprintId, { from: "intro", to: "summary" });

    const untouched = await findEntryRow(database, without.id);
    expect(untouched?.data).toEqual({ title: "No intro" });
    expect(untouched?.version).toBe(without.version);
    const neverPublished = await findEntryRow(database, draft.id);
    expect(neverPublished?.data).toEqual({ summary: "Saved" });
    expect(neverPublished?.publishedData).toBeNull();
    const removed = await findEntryRow(database, publishedOnly.id);
    expect(removed?.data).toEqual({ title: "Removed" });
    expect(removed?.publishedData).toEqual({ summary: "Live" });
  });

  it("leaves other blueprints' entries and revisions alone", async () => {
    const { database } = handle;
    const news = await addCollection(database, "news");
    const events = await addCollection(database, "events");
    const other = await addTestEntry(database, {
      collectionId: events.collectionId,
      data: { intro: "Mine" },
      publishedData: { intro: "Mine" },
    });
    await insertRevision(database, {
      entryId: other.id,
      authorId: null,
      kind: "edited",
      data: { intro: "Mine" },
    });
    await addTestEntry(database, {
      collectionId: news.collectionId,
      slug: "news",
      data: { intro: "News" },
    });

    await moveFieldValues(database, news.blueprintId, { from: "intro", to: "summary" });

    const row = await findEntryRow(database, other.id);
    expect(row?.data).toEqual({ intro: "Mine" });
    expect(row?.publishedData).toEqual({ intro: "Mine" });
    expect(await revisionData(database, other.id)).toEqual([{ intro: "Mine" }]);
  });

  it("does nothing for a blueprint with no entries", async () => {
    const { database } = handle;
    const { blueprintId } = await addCollection(database, "empty");
    const entry = await addTestEntry(database, { data: { intro: "Elsewhere" } });

    await moveFieldValues(database, blueprintId, { from: "intro", to: "summary" });

    expect((await findEntryRow(database, entry.id))?.data).toEqual({ intro: "Elsewhere" });
  });

  it("replaces a value already under the new handle", async () => {
    const { database } = handle;
    const { blueprintId, collectionId } = await addCollection(database, "news");
    const entry = await addTestEntry(database, {
      collectionId,
      data: { intro: "New", summary: "Old" },
    });

    await moveFieldValues(database, blueprintId, { from: "intro", to: "summary" });

    expect((await findEntryRow(database, entry.id))?.data).toEqual({ summary: "New" });
  });
});
