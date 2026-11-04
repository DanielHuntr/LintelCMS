import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { blueprintsTable } from "../blueprints/blueprints.table.js";
import { collectionsTable } from "../collections/collections.table.js";
import type { Database } from "../database/client.js";
import { tableFor } from "../database/dialect/mysql-tables.js";
import { insertReturning } from "../database/dialect/writes.js";
import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";
import {
  addTestEntry,
  addTestSite,
  addTestUser,
  describeOnEveryDatabase,
  findEntryRow,
} from "../testing/every-database.js";
import {
  clearOriginReferences,
  clearParentsInCollection,
  countEntries,
  deleteEntryRow,
  findAncestorIds,
  findEntriesMentioning,
  findEntryById,
  findEntryFieldValues,
  findEntryValuesMentioning,
  findEntryWithDetails,
  findExistingEntryIds,
  findFirstTopLevelEntry,
  findNextSortOrder,
  findSameSlugPages,
  findSlugsStartingWith,
  hasEntryWithValue,
  insertEntry,
  listEntryPositions,
  listEntrySiteIds,
  listEntrySummaries,
  listTranslationFamily,
  makeRoomAfter,
  moveChildrenToParent,
  updateEntryPosition,
  updateEntryRow,
  updateEntryRowAtVersion,
} from "./entries.repository.js";
import { insertRevision, listRevisionsForEntry } from "./revisions.repository.js";

const firstDay = new Date("2026-11-01T10:00:00.125Z");
const secondDay = new Date("2026-11-02T10:00:00.125Z");
const thirdDay = new Date("2026-11-03T10:00:00.125Z");
const fourthDay = new Date("2026-11-04T10:00:00.125Z");
const titleField = { handle: "title", type: "text" } as unknown as FieldDefinition;

async function addCollection(
  database: Database,
  handle: string,
  routePattern: string | null = null,
) {
  const [blueprint] = await insertReturning(database, tableFor(database, blueprintsTable), {
    handle,
    name: handle,
    kind: "entry",
    fields: [titleField],
  });
  if (!blueprint) throw new Error("The test blueprint was not saved.");
  const [collection] = await insertReturning(database, tableFor(database, collectionsTable), {
    handle,
    name: handle,
    blueprintId: blueprint.id,
    routePattern,
  });
  if (!collection) throw new Error("The test collection was not saved.");
  return collection;
}

describeOnEveryDatabase("Entries", (handle) => {
  it("lists summaries with who saved last, and nulls for what isn't set", async () => {
    const { database } = handle;
    const user = await addTestUser(database);
    const full = await addTestEntry(database, {
      slug: "full",
      sortOrder: 0,
      status: "published",
      data: { title: "Full", body: "Long" },
      publishedAt: firstDay,
      scheduledFor: secondDay,
      updatedAt: thirdDay,
      updatedBy: user.id,
    });
    const bare = await addTestEntry(database, { slug: "bare", sortOrder: 1, originId: full.id });
    await addTestEntry(database, { slug: "null-title", sortOrder: 2, data: { title: null } });

    const rows = await listEntrySummaries(database, { collectionId: full.collectionId }, "manual");

    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({
      id: full.id,
      title: "Full",
      slug: "full",
      status: "published",
      parentId: null,
      locale: "en-GB",
      originId: null,
      updatedAt: thirdDay,
      publishedAt: firstDay,
      scheduledFor: secondDay,
      updatedById: user.id,
      updatedByName: "Ada",
    });
    expect(rows[1]).toMatchObject({
      id: bare.id,
      title: null,
      status: "draft",
      originId: full.id,
      publishedAt: null,
      scheduledFor: null,
      updatedById: null,
      updatedByName: null,
    });
    expect(rows[2]?.title).toBeNull();
  });

  it("orders dated entries by when they went live, are due or were started", async () => {
    const { database } = handle;
    const { collectionId } = await addTestEntry(database, {
      slug: "started",
      createdAt: secondDay,
    });
    await addTestEntry(database, {
      slug: "published",
      createdAt: firstDay,
      publishedAt: thirdDay,
    });
    await addTestEntry(database, {
      slug: "scheduled",
      createdAt: firstDay,
      scheduledFor: fourthDay,
    });
    await addTestEntry(database, {
      slug: "same-time",
      createdAt: firstDay,
      publishedAt: secondDay,
    });

    const rows = await listEntrySummaries(database, { collectionId }, "dated");

    expect(rows.map((row) => row.slug)).toEqual(["scheduled", "published", "started", "same-time"]);
  });

  it("orders by hand, oldest first among equals, one page at a time", async () => {
    const { database } = handle;
    const { collectionId } = await addTestEntry(database, { slug: "third", sortOrder: 2 });
    await addTestEntry(database, { slug: "second", sortOrder: 1, createdAt: secondDay });
    await addTestEntry(database, { slug: "first", sortOrder: 1, createdAt: firstDay });

    const rows = await listEntrySummaries(database, { collectionId }, "manual");
    expect(rows.map((row) => row.slug)).toEqual(["first", "second", "third"]);

    const page = await listEntrySummaries(database, { collectionId }, "manual", {
      limit: 1,
      offset: 1,
    });
    expect(page.map((row) => row.slug)).toEqual(["second"]);
  });

  it("filters by site, status, parent and language, in lists and counts", async () => {
    const { database } = handle;
    const parent = await addTestEntry(database, { slug: "parent", status: "published" });
    const { collectionId } = parent;
    const otherSite = await addTestSite(database, "second");
    await addTestEntry(database, { slug: "child", parentId: parent.id });
    await addTestEntry(database, { slug: "french", locale: "fr-FR" });
    await addTestEntry(database, { slug: "elsewhere", siteId: otherSite.id });
    const other = await addCollection(database, "events");
    await addTestEntry(database, { slug: "event", collectionId: other.id });

    const slugsFor = async (filters: Omit<Parameters<typeof countEntries>[1], "collectionId">) => {
      const rows = await listEntrySummaries(database, { collectionId, ...filters }, "manual");
      expect(await countEntries(database, { collectionId, ...filters })).toBe(rows.length);
      return rows.map((row) => row.slug).sort();
    };

    expect(await slugsFor({})).toEqual(["child", "elsewhere", "french", "parent"]);
    expect(await slugsFor({ siteId: otherSite.id })).toEqual(["elsewhere"]);
    expect(await slugsFor({ status: "published" })).toEqual(["parent"]);
    expect(await slugsFor({ parentId: parent.id })).toEqual(["child"]);
    expect(await slugsFor({ locale: "fr-FR" })).toEqual(["french"]);
    expect(await slugsFor({ status: "scheduled" })).toEqual([]);
  });

  it("searches titles ignoring case, taking % and _ literally", async () => {
    const { database } = handle;
    const { collectionId } = await addTestEntry(database, {
      slug: "sale",
      data: { title: "Summer SALE: 100% off" },
    });
    await addTestEntry(database, { slug: "plain", data: { title: "100 things off" } });
    await addTestEntry(database, { slug: "underscore", data: { title: "snake_case" } });
    await addTestEntry(database, { slug: "no-underscore", data: { title: "snakeXcase" } });
    await addTestEntry(database, { slug: "backslash", data: { title: "C:\\temp" } });
    await addTestEntry(database, { slug: "untitled" });

    const slugsFor = async (search: string) => {
      const rows = await listEntrySummaries(database, { collectionId, search }, "manual");
      expect(await countEntries(database, { collectionId, search })).toBe(rows.length);
      return rows.map((row) => row.slug);
    };

    expect(await slugsFor("summer sale")).toEqual(["sale"]);
    expect(await slugsFor("100%")).toEqual(["sale"]);
    expect(await slugsFor("snake_case")).toEqual(["underscore"]);
    expect(await slugsFor("c:\\temp")).toEqual(["backslash"]);
    expect(await slugsFor("nothing like it")).toEqual([]);
  });

  it("ignores the case of accented letters in a search", async () => {
    const { database } = handle;
    const { collectionId } = await addTestEntry(database, { data: { title: "CAFÉ Zoë" } });

    const rows = await listEntrySummaries(database, { collectionId, search: "café" }, "manual");

    expect(rows.map((row) => row.title)).toEqual(["CAFÉ Zoë"]);
  });

  it("finds the values of a few fields, with null for the missing", async () => {
    const { database } = handle;
    const first = await addTestEntry(database, {
      slug: "first",
      data: { title: "One", price: 12.5, tags: ["a"], empty: null, hidden: "no" },
    });
    const second = await addTestEntry(database, { slug: "second", data: { title: "Two" } });

    const values = await findEntryFieldValues(
      database,
      [first.id, second.id, randomUUID()],
      ["price", "tags", "empty"],
    );

    expect(values).toEqual(
      new Map([
        [first.id, { price: 12.5, tags: ["a"], empty: null }],
        [second.id, { price: null, tags: null, empty: null }],
      ]),
    );
    expect(await findEntryFieldValues(database, [], ["price"])).toEqual(new Map());
    expect(await findEntryFieldValues(database, [first.id], [])).toEqual(new Map());
  });

  it("lists where entries sit, on one site when given", async () => {
    const { database } = handle;
    const parent = await addTestEntry(database, {
      slug: "parent",
      sortOrder: 3,
      createdAt: firstDay,
    });
    const otherSite = await addTestSite(database, "second");
    const child = await addTestEntry(database, {
      slug: "child",
      parentId: parent.id,
      sortOrder: 4,
      createdAt: secondDay,
    });
    const elsewhere = await addTestEntry(database, { slug: "elsewhere", siteId: otherSite.id });
    const other = await addCollection(database, "events");
    await addTestEntry(database, { slug: "event", collectionId: other.id });

    const onMainSite = await listEntryPositions(database, parent.collectionId, parent.siteId);
    expect(onMainSite).toHaveLength(2);
    expect(onMainSite).toEqual(
      expect.arrayContaining([
        { id: parent.id, parentId: null, sortOrder: 3, createdAt: firstDay },
        { id: child.id, parentId: parent.id, sortOrder: 4, createdAt: secondDay },
      ]),
    );
    const everywhere = await listEntryPositions(database, parent.collectionId);
    expect(everywhere.map((position) => position.id).sort()).toEqual(
      [parent.id, child.id, elsewhere.id].sort(),
    );
  });

  it("finds an entry by id, with its values and times as written", async () => {
    const { database } = handle;
    const entry = await addTestEntry(database, {
      data: { title: "Café", nested: { list: [1, { deep: true }], nothing: null } },
      publishedData: { title: "Live" },
      publishedAt: firstDay,
      scheduledFor: secondDay,
    });

    const found = await findEntryById(database, entry.id);

    expect(found).toEqual(entry);
    expect(found?.data).toEqual({
      title: "Café",
      nested: { list: [1, { deep: true }], nothing: null },
    });
    expect(found?.publishedAt).toEqual(firstDay);
    expect(await findEntryById(database, randomUUID())).toBeUndefined();
  });

  it("finds an entry with its collection, blueprint and who saved it", async () => {
    const { database } = handle;
    const user = await addTestUser(database);
    const collection = await addCollection(database, "news");
    const entry = await addTestEntry(database, {
      slug: "saved",
      collectionId: collection.id,
      data: { title: "Hello" },
      updatedBy: user.id,
    });
    const nobody = await addTestEntry(database, { slug: "nobody", collectionId: collection.id });

    const details = await findEntryWithDetails(database, entry.id);

    expect(details?.entry).toEqual(entry);
    expect(details?.collectionHandle).toBe("news");
    expect(details?.blueprint).toMatchObject({ handle: "news", fields: [titleField], version: 1 });
    expect(details?.updatedByName).toBe("Ada");
    expect((await findEntryWithDetails(database, nobody.id))?.updatedByName).toBeNull();
    expect(await findEntryWithDetails(database, randomUUID())).toBeUndefined();
  });

  it("adds an entry, filling in what the table gives it", async () => {
    const { database } = handle;
    const { collectionId, siteId } = await addTestEntry(database);

    const entry = await insertEntry(database, { collectionId, siteId, slug: "new" });

    expect(entry).toMatchObject({
      tenantId: "default",
      locale: "en-GB",
      status: "draft",
      data: {},
      publishedData: null,
      publishedAt: null,
      scheduledFor: null,
      sortOrder: 0,
      version: 1,
      parentId: null,
      originId: null,
    });
    expect(entry.id).toEqual(expect.any(String));
    expect(entry.createdAt).toBeInstanceOf(Date);
    expect(await findEntryById(database, entry.id)).toEqual(entry);
  });

  it("refuses a slug already used in the same place, and allows it elsewhere", async () => {
    const { database } = handle;
    const { collectionId, siteId } = await addTestEntry(database, { slug: "taken" });
    const other = await addCollection(database, "events");
    const otherSite = await addTestSite(database, "second");
    const place = { collectionId, siteId, slug: "taken" };

    await expect(insertEntry(database, place)).rejects.toThrow();

    await insertEntry(database, { ...place, locale: "fr-FR" });
    await insertEntry(database, { ...place, collectionId: other.id });
    await insertEntry(database, { ...place, siteId: otherSite.id });
    await insertEntry(database, { ...place, tenantId: "other" });
    expect(await countEntries(database, { collectionId })).toBe(4);
  });

  it("treats slugs as exact, so a different case is a different slug", async () => {
    const { database } = handle;
    const { collectionId, siteId } = await addTestEntry(database, { slug: "taken" });
    await insertEntry(database, { collectionId, siteId, slug: "Taken" });
    await insertEntry(database, { collectionId, siteId, slug: "taken " });
    expect(await countEntries(database, { collectionId })).toBe(3);
  });

  it("changes an entry, moving its version and time on", async () => {
    const { database } = handle;
    const entry = await addTestEntry(database, {
      data: { title: "Old" },
      publishedData: { title: "Old" },
      publishedAt: firstDay,
      updatedAt: firstDay,
    });

    const updated = await updateEntryRow(database, entry.id, {
      slug: "renamed",
      data: { title: "New", tags: ["a"] },
      publishedData: null,
      publishedAt: null,
      scheduledFor: secondDay,
    });

    expect(updated).toMatchObject({
      id: entry.id,
      slug: "renamed",
      data: { title: "New", tags: ["a"] },
      publishedData: null,
      publishedAt: null,
      scheduledFor: secondDay,
      version: entry.version + 1,
      createdAt: entry.createdAt,
    });
    expect(updated.updatedAt.getTime()).toBeGreaterThan(firstDay.getTime());
    expect(await findEntryById(database, entry.id)).toEqual(updated);
  });

  it("says so when changing an entry that isn't there", async () => {
    const { database } = handle;
    await expect(updateEntryRow(database, randomUUID(), { slug: "gone" })).rejects.toThrow(
      "The database did not return the updated entry.",
    );
  });

  it("saves only from the version it started from", async () => {
    const { database } = handle;
    const entry = await addTestEntry(database, { data: { title: "Start" } });

    const first = await updateEntryRowAtVersion(database, entry.id, entry.version, {
      data: { title: "First" },
    });
    expect(first).toMatchObject({ data: { title: "First" }, version: entry.version + 1 });

    const second = await updateEntryRowAtVersion(database, entry.id, entry.version, {
      data: { title: "Second" },
    });
    expect(second).toBeUndefined();
    expect(await findEntryById(database, entry.id)).toEqual(first);

    expect(
      await updateEntryRowAtVersion(database, randomUUID(), 1, { slug: "gone" }),
    ).toBeUndefined();
  });

  it("deletes an entry with its revisions", async () => {
    const { database } = handle;
    const entry = await addTestEntry(database, { slug: "gone" });
    const kept = await addTestEntry(database, { slug: "kept" });
    for (const entryId of [entry.id, kept.id]) {
      await insertRevision(database, { entryId, authorId: null, kind: "edited", data: {} });
    }

    await deleteEntryRow(database, entry.id);

    expect(await findEntryById(database, entry.id)).toBeUndefined();
    expect(await listRevisionsForEntry(database, entry.id)).toEqual([]);
    expect(await listRevisionsForEntry(database, kept.id)).toHaveLength(1);
    await expect(deleteEntryRow(database, randomUUID())).resolves.toBeUndefined();
  });

  it("refuses to delete an entry that others still hang from", async () => {
    const { database } = handle;
    const parent = await addTestEntry(database, { slug: "parent" });
    const origin = await addTestEntry(database, { slug: "origin" });
    await addTestEntry(database, { slug: "child", parentId: parent.id });
    await addTestEntry(database, { slug: "copy", locale: "fr-FR", originId: origin.id });

    await expect(deleteEntryRow(database, parent.id)).rejects.toThrow();
    await expect(deleteEntryRow(database, origin.id)).rejects.toThrow();
    expect(await findEntryById(database, parent.id)).toBeDefined();
  });

  it("walks up to the top, nearest first, across collections", async () => {
    const { database } = handle;
    const top = await addTestEntry(database, { slug: "top" });
    const middle = await addTestEntry(database, { slug: "middle", parentId: top.id });
    const other = await addCollection(database, "events");
    const bottom = await addTestEntry(database, {
      slug: "bottom",
      collectionId: other.id,
      parentId: middle.id,
    });

    expect(await findAncestorIds(database, bottom.id)).toEqual([bottom.id, middle.id, top.id]);
    expect(await findAncestorIds(database, top.id)).toEqual([top.id]);
    expect(await findAncestorIds(database, randomUUID())).toEqual([]);
  });

  it("stops at a loop in the tree", async () => {
    const { database } = handle;
    const first = await addTestEntry(database, { slug: "first" });
    const second = await addTestEntry(database, { slug: "second", parentId: first.id });
    await updateEntryPosition(database, first.id, { parentId: second.id, sortOrder: 0 });

    expect(await findAncestorIds(database, second.id)).toEqual([second.id, first.id]);
  });

  it("gives an entry's children a new parent, or none", async () => {
    const { database } = handle;
    const top = await addTestEntry(database, { slug: "top" });
    const middle = await addTestEntry(database, { slug: "middle", parentId: top.id });
    const child = await addTestEntry(database, { slug: "child", parentId: middle.id });
    const other = await addTestEntry(database, { slug: "other", parentId: top.id });

    await moveChildrenToParent(database, middle.id, top.id);
    expect((await findEntryRow(database, child.id))?.parentId).toBe(top.id);
    expect((await findEntryRow(database, child.id))?.version).toBe(child.version + 1);

    await moveChildrenToParent(database, top.id, null);
    expect((await findEntryRow(database, child.id))?.parentId).toBeNull();
    expect((await findEntryRow(database, middle.id))?.parentId).toBeNull();
    expect((await findEntryRow(database, other.id))?.parentId).toBeNull();

    await deleteEntryRow(database, top.id);
    expect(await findEntryById(database, top.id)).toBeUndefined();
  });

  it("stops translations pointing at an entry, so it can be deleted", async () => {
    const { database } = handle;
    const origin = await addTestEntry(database, { slug: "origin" });
    const otherOrigin = await addTestEntry(database, { slug: "other-origin" });
    const copy = await addTestEntry(database, {
      slug: "copy",
      locale: "fr-FR",
      originId: origin.id,
    });
    const otherCopy = await addTestEntry(database, {
      slug: "other-copy",
      locale: "fr-FR",
      originId: otherOrigin.id,
    });

    await clearOriginReferences(database, origin.id);

    expect((await findEntryRow(database, copy.id))?.originId).toBeNull();
    expect((await findEntryRow(database, otherCopy.id))?.originId).toBe(otherOrigin.id);
    await deleteEntryRow(database, origin.id);
    expect(await findEntryById(database, copy.id)).toBeDefined();
  });

  it("flattens one collection's tree, leaving the others", async () => {
    const { database } = handle;
    const parent = await addTestEntry(database, { slug: "parent" });
    const child = await addTestEntry(database, { slug: "child", parentId: parent.id });
    const other = await addCollection(database, "events");
    const event = await addTestEntry(database, {
      slug: "event",
      collectionId: other.id,
      parentId: parent.id,
    });

    await clearParentsInCollection(database, parent.collectionId);

    expect((await findEntryRow(database, child.id))?.parentId).toBeNull();
    expect((await findEntryRow(database, event.id))?.parentId).toBe(parent.id);
  });

  it("finds slugs that are the base, or the base and a dash", async () => {
    const { database } = handle;
    const { collectionId, siteId, id } = await addTestEntry(database, { slug: "hello" });
    await addTestEntry(database, { slug: "hello-2" });
    await addTestEntry(database, { slug: "hello-world" });
    await addTestEntry(database, { slug: "hellothere" });
    await addTestEntry(database, { slug: "Hello-3" });
    await addTestEntry(database, { slug: "say-hello" });
    await addTestEntry(database, { slug: "hello-fr", locale: "fr-FR" });
    const otherSite = await addTestSite(database, "second");
    await addTestEntry(database, { slug: "hello-site", siteId: otherSite.id });
    const other = await addCollection(database, "events");
    await addTestEntry(database, { slug: "hello-event", collectionId: other.id });
    const scope = { collectionId, siteId, locale: "en-GB" };

    const slugs = await findSlugsStartingWith(database, scope, "hello");
    expect(slugs.sort()).toEqual(["hello", "hello-2", "hello-world"]);

    const except = await findSlugsStartingWith(database, { ...scope, exceptEntryId: id }, "hello");
    expect(except.sort()).toEqual(["hello-2", "hello-world"]);

    expect(await findSlugsStartingWith(database, scope, "nothing")).toEqual([]);
  });

  it("finds the next place among siblings", async () => {
    const { database } = handle;
    const collection = await addCollection(database, "news");
    const collectionId = collection.id;
    expect(await findNextSortOrder(database, collectionId, null)).toBe(0);

    const parent = await addTestEntry(database, { collectionId, slug: "parent", sortOrder: 4 });
    const other = await addCollection(database, "events");
    await addTestEntry(database, { collectionId: other.id, slug: "event", sortOrder: 9 });
    expect(await findNextSortOrder(database, collectionId, null)).toBe(5);

    expect(await findNextSortOrder(database, collectionId, parent.id)).toBe(0);
    await addTestEntry(database, {
      collectionId: other.id,
      slug: "child",
      parentId: parent.id,
      sortOrder: 2,
    });
    expect(await findNextSortOrder(database, collectionId, parent.id)).toBe(3);
  });

  it("makes room after a place, among those siblings only", async () => {
    const { database } = handle;
    const collection = await addCollection(database, "news");
    const collectionId = collection.id;
    const add = (slug: string, sortOrder: number, parentId: string | null = null) =>
      addTestEntry(database, { collectionId, slug, sortOrder, parentId });
    const first = await add("first", 0);
    const second = await add("second", 1);
    const third = await add("third", 2);
    const child = await add("child", 5, first.id);
    const other = await addCollection(database, "events");
    const event = await addTestEntry(database, {
      collectionId: other.id,
      slug: "event",
      sortOrder: 5,
    });

    await makeRoomAfter(database, collectionId, null, 0);

    const orderOf = async (entryId: string) => (await findEntryRow(database, entryId))?.sortOrder;
    expect(await orderOf(first.id)).toBe(0);
    expect(await orderOf(second.id)).toBe(2);
    expect(await orderOf(third.id)).toBe(3);
    expect(await orderOf(child.id)).toBe(5);
    expect(await orderOf(event.id)).toBe(5);

    await makeRoomAfter(database, collectionId, first.id, 4);
    expect(await orderOf(child.id)).toBe(6);
    expect(await orderOf(second.id)).toBe(2);
  });

  it("moves an entry to a new place", async () => {
    const { database } = handle;
    const parent = await addTestEntry(database, { slug: "parent" });
    const entry = await addTestEntry(database, { slug: "child", sortOrder: 3 });

    await updateEntryPosition(database, entry.id, { parentId: parent.id, sortOrder: 7 });
    expect(await findEntryRow(database, entry.id)).toMatchObject({
      parentId: parent.id,
      sortOrder: 7,
      version: entry.version + 1,
    });

    await updateEntryPosition(database, entry.id, { parentId: null, sortOrder: 0 });
    expect(await findEntryRow(database, entry.id)).toMatchObject({ parentId: null, sortOrder: 0 });
  });

  it("finds entries that mention an id, in saved or published values", async () => {
    const { database } = handle;
    const id = randomUUID();
    const saved = await addTestEntry(database, {
      slug: "saved",
      data: { title: "Saved", hero: id },
    });
    const published = await addTestEntry(database, {
      slug: "published",
      data: { title: "Published" },
      publishedData: { blocks: [{ image: { asset: id } }] },
    });
    const byAddress = await addTestEntry(database, {
      slug: "by-address",
      data: { cursor: `https://example.com/media/${id}/file?width=40` },
    });
    const publishedAddress = await addTestEntry(database, {
      slug: "published-address",
      publishedData: { cursor: `/media/${id}/file` },
    });
    await addTestEntry(database, { slug: "inside-text", data: { body: `see ${id} here` } });
    await addTestEntry(database, { slug: "other", data: { hero: randomUUID() } });

    const rows = await findEntriesMentioning(database, id);

    expect(rows).toHaveLength(4);
    expect(rows).toEqual(
      expect.arrayContaining([
        { entryId: saved.id, title: "Saved" },
        { entryId: published.id, title: "Published" },
        { entryId: byAddress.id, title: null },
        { entryId: publishedAddress.id, title: null },
      ]),
    );
  });

  it("finds the values of entries that mention an id as a value", async () => {
    const { database } = handle;
    const id = randomUUID();
    const saved = await addTestEntry(database, { slug: "saved", data: { list: [id, "a"] } });
    const published = await addTestEntry(database, {
      slug: "published",
      data: { title: "Removed" },
      publishedData: { hero: id },
    });
    await addTestEntry(database, {
      slug: "by-address",
      data: { cursor: `/media/${id}/file` },
    });

    const rows = await findEntryValuesMentioning(database, id);

    expect(rows).toHaveLength(2);
    expect(rows).toEqual(
      expect.arrayContaining([
        { id: saved.id, data: { list: [id, "a"] }, publishedData: null },
        { id: published.id, data: { title: "Removed" }, publishedData: { hero: id } },
      ]),
    );
    expect(await findEntryValuesMentioning(database, randomUUID())).toEqual([]);
  });

  it("finds the first page at the top of a tree", async () => {
    const { database } = handle;
    const parent = await addTestEntry(database, {
      slug: "second",
      sortOrder: 1,
      createdAt: secondDay,
    });
    const { collectionId, siteId } = parent;
    const first = await addTestEntry(database, {
      slug: "first",
      sortOrder: 1,
      createdAt: firstDay,
    });
    await addTestEntry(database, { slug: "child", parentId: parent.id, sortOrder: 0 });
    await addTestEntry(database, { slug: "french", locale: "fr-FR", sortOrder: 0 });
    const scope = { collectionId, siteId, locale: "en-GB" };

    expect((await findFirstTopLevelEntry(database, scope))?.id).toBe(first.id);
    expect(await findFirstTopLevelEntry(database, { ...scope, locale: "de-DE" })).toBeUndefined();
  });

  it("lists an entry and its translations, oldest first", async () => {
    const { database } = handle;
    const root = await addTestEntry(database, {
      slug: "root",
      createdAt: secondDay,
      status: "published",
      data: { title: "Home" },
    });
    const french = await addTestEntry(database, {
      slug: "french",
      locale: "fr-FR",
      originId: root.id,
      createdAt: firstDay,
    });
    await addTestEntry(database, { slug: "stranger" });

    expect(await listTranslationFamily(database, root.id)).toEqual([
      { id: french.id, locale: "fr-FR", title: null, status: "draft" },
      { id: root.id, locale: "en-GB", title: "Home", status: "published" },
    ]);
    expect(await listTranslationFamily(database, randomUUID())).toEqual([]);
  });

  it("finds an entry holding a value, within a collection and language", async () => {
    const { database } = handle;
    const entry = await addTestEntry(database, {
      data: { code: "ABC", price: 12.5, active: true, spec: { b: 2, a: 1 }, nothing: null },
    });
    const { collectionId } = entry;
    const anywhere = { collectionId, locale: "en-GB", exceptEntryId: null };

    expect(await hasEntryWithValue(database, anywhere, "code", "ABC")).toBe(true);
    expect(await hasEntryWithValue(database, anywhere, "code", "abc")).toBe(false);
    expect(await hasEntryWithValue(database, anywhere, "price", 12.5)).toBe(true);
    expect(await hasEntryWithValue(database, anywhere, "price", "12.5")).toBe(false);
    expect(await hasEntryWithValue(database, anywhere, "active", true)).toBe(true);
    expect(await hasEntryWithValue(database, anywhere, "active", false)).toBe(false);
    expect(await hasEntryWithValue(database, anywhere, "spec", { a: 1, b: 2 })).toBe(true);
    expect(await hasEntryWithValue(database, anywhere, "spec", { a: 1 })).toBe(false);
    expect(await hasEntryWithValue(database, anywhere, "nothing", null)).toBe(true);
    expect(await hasEntryWithValue(database, anywhere, "missing", "ABC")).toBe(false);
    expect(await hasEntryWithValue(database, anywhere, "missing", null)).toBe(false);

    const exceptItself = { ...anywhere, exceptEntryId: entry.id };
    expect(await hasEntryWithValue(database, exceptItself, "code", "ABC")).toBe(false);
    const inFrench = { ...anywhere, locale: "fr-FR" };
    expect(await hasEntryWithValue(database, inFrench, "code", "ABC")).toBe(false);
    const other = await addCollection(database, "events");
    const elsewhere = { ...anywhere, collectionId: other.id };
    expect(await hasEntryWithValue(database, elsewhere, "code", "ABC")).toBe(false);
  });

  it("tells a list from its items when looking for a value", async () => {
    const { database } = handle;
    const { collectionId } = await addTestEntry(database, { data: { tags: ["a", "b"], one: "a" } });
    const anywhere = { collectionId, locale: "en-GB", exceptEntryId: null };

    expect(await hasEntryWithValue(database, anywhere, "tags", ["a", "b"])).toBe(true);
    expect(await hasEntryWithValue(database, anywhere, "tags", ["a"])).toBe(false);
    expect(await hasEntryWithValue(database, anywhere, "tags", "a")).toBe(false);
    expect(await hasEntryWithValue(database, anywhere, "one", ["a"])).toBe(false);
  });

  it("counts a list in another order as a different value", async () => {
    const { database } = handle;
    const { collectionId } = await addTestEntry(database, { data: { tags: ["a", "b"] } });
    const anywhere = { collectionId, locale: "en-GB", exceptEntryId: null };

    expect(await hasEntryWithValue(database, anywhere, "tags", ["b", "a"])).toBe(false);
  });

  it("counts a list with a repeated item as a different value", async () => {
    const { database } = handle;
    const { collectionId } = await addTestEntry(database, { data: { tags: ["a", "a"] } });
    const anywhere = { collectionId, locale: "en-GB", exceptEntryId: null };

    expect(await hasEntryWithValue(database, anywhere, "tags", ["a"])).toBe(false);
  });

  it("lists the sites of entries, each once", async () => {
    const { database } = handle;
    const first = await addTestEntry(database, { slug: "first" });
    const second = await addTestEntry(database, { slug: "second" });
    const otherSite = await addTestSite(database, "second");
    const third = await addTestEntry(database, { slug: "third", siteId: otherSite.id });

    const siteIds = await listEntrySiteIds(database, [first.id, second.id, third.id, randomUUID()]);

    expect(siteIds.sort()).toEqual([first.siteId, otherSite.id].sort());
    expect(await listEntrySiteIds(database, [])).toEqual([]);
    expect(await listEntrySiteIds(database, [randomUUID()])).toEqual([]);
  });

  it("says which ids are entries, in the collections named", async () => {
    const { database } = handle;
    const page = await addTestEntry(database, { slug: "page" });
    const other = await addCollection(database, "events");
    const event = await addTestEntry(database, { slug: "event", collectionId: other.id });
    const ids = [page.id, event.id, randomUUID()];

    expect((await findExistingEntryIds(database, ids, [])).sort()).toEqual(
      [page.id, event.id].sort(),
    );
    expect(await findExistingEntryIds(database, ids, ["events"])).toEqual([event.id]);
    expect(await findExistingEntryIds(database, ids, ["nothing"])).toEqual([]);
    expect(await findExistingEntryIds(database, [], ["events"])).toEqual([]);
  });

  it("finds pages with the same slug in other collections that have addresses", async () => {
    const { database } = handle;
    const entry = await addTestEntry(database, { slug: "about" });
    const { siteId } = entry;
    const addressed = await addCollection(database, "landing", "/{slug}");
    const clash = await addTestEntry(database, {
      slug: "about",
      siteId,
      collectionId: addressed.id,
      publishedAt: firstDay,
      data: { title: "About us" },
    });
    await addTestEntry(database, {
      slug: "about",
      siteId,
      collectionId: addressed.id,
      locale: "fr-FR",
    });
    await addTestEntry(database, { slug: "other", siteId, collectionId: addressed.id });
    const noAddress = await addCollection(database, "snippets");
    await addTestEntry(database, { slug: "about", siteId, collectionId: noAddress.id });
    const otherSite = await addTestSite(database, "second");
    await addTestEntry(database, {
      slug: "about",
      siteId: otherSite.id,
      collectionId: addressed.id,
    });
    await addTestEntry(database, { slug: "about", siteId: otherSite.id });

    expect(await findSameSlugPages(database, entry)).toEqual([
      {
        id: clash.id,
        slug: "about",
        publishedAt: firstDay,
        title: "About us",
        routePattern: "/{slug}",
      },
    ]);
  });
});
