import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import { blueprintsTable } from "../blueprints/blueprints.table.js";
import { clientReviewsTable } from "../client-editing/client-reviews.table.js";
import { collectionsTable, type NewCollection } from "../collections/collections.table.js";
import type { Database } from "../database/client.js";
import { jsonWithKeyRenamed } from "../database/dialect/json-expressions.js";
import { tableFor } from "../database/dialect/mysql-tables.js";
import { insertReturning } from "../database/dialect/writes.js";
import { entriesTable } from "../entries/entries.table.js";
import { sitesTable } from "../sites/sites.table.js";
import {
  addTestEntry,
  addTestSite,
  addTestUser,
  describeOnEveryDatabase,
  findEntryRow,
} from "../testing/every-database.js";
import {
  countChildrenOf,
  countItems,
  countNodes,
  countTopLevelByCollection,
  findNodeRows,
  findNodesMentioning,
  findPersonNames,
  listChildLinks,
  listItemRows,
  listNodeRows,
  listSiblingIds,
  listSites,
  listTypesAt,
  renumberSiblings,
  searchNodeRows,
} from "./content-tree.repository.js";

const firstDay = new Date("2026-11-01T10:00:00.125Z");
const secondDay = new Date("2026-11-02T10:00:00.125Z");
const thirdDay = new Date("2026-11-03T10:00:00.125Z");
const fourthDay = new Date("2026-11-04T10:00:00.125Z");
const everything = { limit: 50, offset: 0 };
const plainList = {
  filters: {},
  sort: "manual" as const,
  direction: "asc" as const,
  columns: [],
  page: everything,
};

async function addCollection(
  database: Database,
  handle: string,
  values: Partial<NewCollection> = {},
) {
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
    ...values,
  });
  if (!collection) throw new Error("The test collection was not saved.");
  return collection;
}

/** The top of the collection an entry is in. */
function topOf(entry: { collectionId: string; siteId: string; locale: string }) {
  const { collectionId, siteId, locale } = entry;
  return { collectionId, siteId, locale };
}

describeOnEveryDatabase("Content tree", (handle) => {
  it("reads a node with real booleans, times and its collection", async () => {
    const { database } = handle;
    const collection = await addCollection(database, "shop", {
      name: "Shop",
      structure: "tree",
      routePattern: "/{slug}",
      childrenAsCollection: true,
    });
    const entry = await addTestEntry(database, {
      collectionId: collection.id,
      slug: "start",
      sortOrder: 3,
      status: "published",
      data: { title: "Start" },
      publishedData: { title: "Start" },
      publishedAt: firstDay,
      scheduledFor: secondDay,
      updatedAt: thirdDay,
    });

    const rows = await listNodeRows(database, topOf(entry), "manual", everything);

    expect(rows).toEqual([
      {
        id: entry.id,
        title: "Start",
        slug: "start",
        status: "published",
        hasUnpublishedChanges: false,
        scheduledFor: secondDay,
        updatedAt: thirdDay,
        parentId: null,
        locale: "en-GB",
        sortOrder: 3,
        collectionHandle: "shop",
        collectionName: "Shop",
        childrenAsCollection: true,
        isSiteStart: true,
        routePattern: "/{slug}",
        publishedAt: firstDay,
      },
    ]);
  });

  it("gives null for a missing or JSON null title", async () => {
    const { database } = handle;
    const missing = await addTestEntry(database, { slug: "missing" });
    const empty = await addTestEntry(database, { slug: "empty", data: { title: null } });

    const rows = await findNodeRows(database, [missing.id, empty.id]);

    expect(rows.map((row) => row.title)).toEqual([null, null]);
  });

  it("doesn't call a renamed field an unpublished change", async () => {
    const { database } = handle;
    const entries = tableFor(database, entriesTable);
    const entry = await addTestEntry(database, {
      slug: "renamed",
      data: { long_handle: 1, b: { y: 2, x: [1, 2] } },
      publishedData: { a: 1, b: { x: [1, 2], y: 2 } },
    });
    // On MariaDB, whose json is text, the moved key now comes last.
    await database
      .update(entries)
      .set({ data: jsonWithKeyRenamed(database, entries.data, "long_handle", "a") })
      .where(eq(entries.id, entry.id));

    const [row] = await findNodeRows(database, [entry.id]);
    expect(row?.hasUnpublishedChanges).toBe(false);
  });

  it("sees unpublished changes by value, whatever order the keys are in", async () => {
    const { database } = handle;
    const add = (slug: string, data: Record<string, unknown>, publishedData: unknown) =>
      addTestEntry(database, {
        slug,
        data,
        publishedData: publishedData as Record<string, unknown> | null,
      });
    const never = await add("never", { title: "Draft" }, null);
    const same = await add("same", { a: 1, b: 2 }, { a: 1, b: 2 });
    const reordered = await add("reordered", { b: 2, a: 1 }, { a: 1, b: 2 });
    const deep = await add(
      "deep",
      { group: { longer: [{ z: 1, a: 2 }], b: 1 } },
      { group: { b: 1, longer: [{ a: 2, z: 1 }] } },
    );
    const changed = await add("changed", { a: 1, b: 3 }, { a: 1, b: 2 });
    const listOrder = await add("list-order", { list: [1, 2] }, { list: [2, 1] });

    const rows = await findNodeRows(database, [
      never.id,
      same.id,
      reordered.id,
      deep.id,
      changed.id,
      listOrder.id,
    ]);

    const bySlug = Object.fromEntries(rows.map((row) => [row.slug, row.hasUnpublishedChanges]));
    expect(bySlug).toEqual({
      never: false,
      same: false,
      reordered: false,
      deep: false,
      changed: true,
      "list-order": true,
    });
  });

  it("marks only the top of an addressed page tree as a site start", async () => {
    const { database } = handle;
    const tree = await addCollection(database, "site", { structure: "tree", routePattern: "/" });
    const unaddressed = await addCollection(database, "parts", { structure: "tree" });
    const flat = await addCollection(database, "news", { routePattern: "/{slug}" });
    const top = await addTestEntry(database, { slug: "top", collectionId: tree.id });
    const child = await addTestEntry(database, {
      slug: "child",
      collectionId: tree.id,
      parentId: top.id,
    });
    const part = await addTestEntry(database, { slug: "part", collectionId: unaddressed.id });
    const post = await addTestEntry(database, { slug: "post", collectionId: flat.id });

    const rows = await findNodeRows(database, [top.id, child.id, part.id, post.id]);

    const bySlug = Object.fromEntries(rows.map((row) => [row.slug, row.isSiteStart]));
    expect(bySlug).toEqual({ top: true, child: false, part: false, post: false });
  });

  it("lists nodes at each kind of place, and counts them", async () => {
    const { database } = handle;
    const parent = await addTestEntry(database, { slug: "parent", sortOrder: 0 });
    const child = await addTestEntry(database, { slug: "child", parentId: parent.id });
    const other = await addCollection(database, "events");
    const event = await addTestEntry(database, {
      slug: "event",
      collectionId: other.id,
      parentId: parent.id,
      sortOrder: 1,
    });
    await addTestEntry(database, { slug: "french", locale: "fr-FR" });
    const otherSite = await addTestSite(database, "second");
    await addTestEntry(database, { slug: "elsewhere", siteId: otherSite.id });

    const idsAt = async (place: Parameters<typeof countNodes>[1]) => {
      const rows = await listNodeRows(database, place, "manual", everything);
      expect(await countNodes(database, place)).toBe(rows.length);
      return rows.map((row) => row.id);
    };

    expect(await idsAt(topOf(parent))).toEqual([parent.id]);
    expect(await idsAt({ parentId: parent.id })).toEqual([child.id, event.id]);
    expect(await idsAt({ parentId: child.id })).toEqual([]);
    expect((await idsAt({ entryIds: [event.id, parent.id] })).sort()).toEqual(
      [event.id, parent.id].sort(),
    );
    expect(await idsAt({ entryIds: [] })).toEqual([]);
  });

  it("orders nodes by hand or by date, one page at a time", async () => {
    const { database } = handle;
    const first = await addTestEntry(database, {
      slug: "started",
      sortOrder: 2,
      createdAt: secondDay,
    });
    await addTestEntry(database, {
      slug: "published",
      sortOrder: 1,
      createdAt: firstDay,
      publishedAt: thirdDay,
    });
    await addTestEntry(database, {
      slug: "scheduled",
      sortOrder: 1,
      createdAt: secondDay,
      scheduledFor: fourthDay,
    });
    const place = topOf(first);
    const slugs = (rows: { slug: string }[]) => rows.map((row) => row.slug);

    const manual = await listNodeRows(database, place, "manual", everything);
    expect(slugs(manual)).toEqual(["published", "scheduled", "started"]);

    const dated = await listNodeRows(database, place, "dated", everything);
    expect(slugs(dated)).toEqual(["scheduled", "published", "started"]);

    const page = await listNodeRows(database, place, "dated", { limit: 1, offset: 1 });
    expect(slugs(page)).toEqual(["published"]);
  });

  it("counts the children of each parent, leaving out those with none", async () => {
    const { database } = handle;
    const parent = await addTestEntry(database, { slug: "parent" });
    const lonely = await addTestEntry(database, { slug: "lonely" });
    await addTestEntry(database, { slug: "one", parentId: parent.id });
    const two = await addTestEntry(database, { slug: "two", parentId: parent.id });
    await addTestEntry(database, { slug: "below", parentId: two.id });

    expect(await countChildrenOf(database, [parent.id, lonely.id])).toEqual(
      new Map([[parent.id, 2]]),
    );
    expect(await countChildrenOf(database, [])).toEqual(new Map());
  });

  it("counts top-level entries of each collection, in one site and language", async () => {
    const { database } = handle;
    const parent = await addTestEntry(database, { slug: "one" });
    await addTestEntry(database, { slug: "two" });
    await addTestEntry(database, { slug: "child", parentId: parent.id });
    await addTestEntry(database, { slug: "french", locale: "fr-FR" });
    const other = await addCollection(database, "events");
    await addTestEntry(database, { slug: "event", collectionId: other.id });
    const otherSite = await addTestSite(database, "second");
    await addTestEntry(database, { slug: "elsewhere", siteId: otherSite.id });

    expect(await countTopLevelByCollection(database, parent.siteId, "en-GB")).toEqual(
      new Map([
        [parent.collectionId, 2],
        [other.id, 1],
      ]),
    );
    expect(await countTopLevelByCollection(database, parent.siteId, "de-DE")).toEqual(new Map());
  });

  it("lists items with their columns and who saved them", async () => {
    const { database } = handle;
    const user = await addTestUser(database);
    const entry = await addTestEntry(database, {
      slug: "full",
      sortOrder: 0,
      updatedBy: user.id,
      publishedAt: firstDay,
      data: {
        title: "Full",
        price: 12.5,
        active: false,
        tags: ["a", "b"],
        spec: { size: "L", nested: { deep: 1 } },
        nothing: null,
        hidden: "Not asked for",
      },
    });
    const bare = await addTestEntry(database, { slug: "bare", sortOrder: 1 });

    const rows = await listItemRows(database, topOf(entry), {
      ...plainList,
      columns: ["price", "active", "tags", "spec", "nothing", "missing"],
    });

    expect(rows.map((row) => row.id)).toEqual([entry.id, bare.id]);
    expect(rows[0]).toMatchObject({
      title: "Full",
      updatedByName: "Ada",
      routePattern: "/{slug}",
      publishedAt: firstDay,
      hasUnpublishedChanges: false,
      isSiteStart: false,
    });
    expect(rows[0]?.values).toEqual({
      price: 12.5,
      active: false,
      tags: ["a", "b"],
      spec: { size: "L", nested: { deep: 1 } },
      nothing: null,
      missing: null,
    });
    expect(rows[1]?.updatedByName).toBeNull();
    expect(rows[1]?.values).toEqual({
      price: null,
      active: null,
      tags: null,
      spec: null,
      nothing: null,
      missing: null,
    });
  });

  it("gives empty values when no columns are asked for", async () => {
    const { database } = handle;
    const entry = await addTestEntry(database, { data: { title: "Plain" } });
    const rows = await listItemRows(database, topOf(entry), plainList);
    expect(rows.map((row) => row.values)).toEqual([{}]);
  });

  it("keeps a branch in the order its ids were given", async () => {
    const { database } = handle;
    const first = await addTestEntry(database, { slug: "first", sortOrder: 0 });
    const second = await addTestEntry(database, { slug: "second", sortOrder: 1 });
    const third = await addTestEntry(database, { slug: "third", sortOrder: 2 });
    const entryIds = [third.id, first.id, second.id];

    const rows = await listItemRows(database, { entryIds }, plainList);
    expect(rows.map((row) => row.id)).toEqual(entryIds);

    const page = await listItemRows(
      database,
      { entryIds },
      { ...plainList, page: { limit: 1, offset: 1 } },
    );
    expect(page.map((row) => row.id)).toEqual([first.id]);

    expect(await listItemRows(database, { entryIds: [] }, plainList)).toEqual([]);
  });

  it("sorts items by date, newest first", async () => {
    const { database } = handle;
    const entry = await addTestEntry(database, { slug: "older", createdAt: firstDay });
    await addTestEntry(database, { slug: "newer", createdAt: secondDay });

    const rows = await listItemRows(database, topOf(entry), { ...plainList, sort: "dated" });

    expect(rows.map((row) => row.slug)).toEqual(["newer", "older"]);
  });

  it("sorts by title ignoring case, with untitled items last either way", async () => {
    const { database } = handle;
    const entry = await addTestEntry(database, { slug: "b", data: { title: "Banana" } });
    await addTestEntry(database, { slug: "c", data: { title: "cherry" } });
    await addTestEntry(database, { slug: "a", data: { title: "apple" } });
    await addTestEntry(database, { slug: "none" });
    await addTestEntry(database, { slug: "json-null", createdAt: firstDay, data: { title: null } });
    const sort = { by: "title" as const };
    const slugs = async (direction: "asc" | "desc") => {
      const rows = await listItemRows(database, topOf(entry), { ...plainList, sort, direction });
      return rows.map((row) => row.slug);
    };

    expect(await slugs("asc")).toEqual(["a", "b", "c", "none", "json-null"]);
    expect(await slugs("desc")).toEqual(["c", "b", "a", "none", "json-null"]);
  });

  it("sorts by status, by publishing and by last change", async () => {
    const { database } = handle;
    const entry = await addTestEntry(database, {
      slug: "draft",
      status: "draft",
      updatedAt: thirdDay,
    });
    await addTestEntry(database, {
      slug: "published",
      status: "published",
      publishedAt: firstDay,
      updatedAt: firstDay,
    });
    await addTestEntry(database, {
      slug: "scheduled",
      status: "scheduled",
      publishedAt: secondDay,
      updatedAt: secondDay,
    });
    const place = topOf(entry);
    const slugs = async (
      by: "status" | "published" | "updated",
      direction: "asc" | "desc",
    ): Promise<string[]> => {
      const rows = await listItemRows(database, place, {
        ...plainList,
        sort: { by },
        direction,
      });
      return rows.map((row) => row.slug);
    };

    expect(await slugs("status", "asc")).toEqual(["draft", "published", "scheduled"]);
    expect(await slugs("status", "desc")).toEqual(["scheduled", "published", "draft"]);
    expect(await slugs("published", "asc")).toEqual(["published", "scheduled", "draft"]);
    expect(await slugs("published", "desc")).toEqual(["scheduled", "published", "draft"]);
    expect(await slugs("updated", "asc")).toEqual(["published", "scheduled", "draft"]);
    expect(await slugs("updated", "desc")).toEqual(["draft", "scheduled", "published"]);
  });

  it("sorts by a field's stored value, with missing values last", async () => {
    const { database } = handle;
    const entry = await addTestEntry(database, { slug: "b", data: { colour: "blue" } });
    await addTestEntry(database, { slug: "a", data: { colour: "amber" } });
    await addTestEntry(database, { slug: "none", createdAt: secondDay });
    await addTestEntry(database, {
      slug: "json-null",
      createdAt: firstDay,
      data: { colour: null },
    });
    const sort = { by: "field" as const, handle: "colour" };
    const slugs = async (direction: "asc" | "desc") => {
      const rows = await listItemRows(database, topOf(entry), { ...plainList, sort, direction });
      return rows.map((row) => row.slug);
    };

    expect(await slugs("asc")).toEqual(["a", "b", "none", "json-null"]);
    expect(await slugs("desc")).toEqual(["b", "a", "none", "json-null"]);
  });

  it("filters items by search, status and type, in lists and counts", async () => {
    const { database } = handle;
    const parent = await addTestEntry(database, { slug: "parent" });
    const other = await addCollection(database, "events", { name: "Events" });
    const place = { parentId: parent.id };
    await addTestEntry(database, {
      slug: "sale",
      parentId: parent.id,
      status: "published",
      data: { title: "Summer SALE 100%" },
    });
    await addTestEntry(database, {
      slug: "plain",
      parentId: parent.id,
      data: { title: "100 things" },
    });
    await addTestEntry(database, {
      slug: "under_score",
      parentId: parent.id,
      collectionId: other.id,
      data: { title: "snake_case" },
    });
    await addTestEntry(database, {
      slug: "untitled",
      parentId: parent.id,
      data: { title: "snakeXcase" },
    });

    const slugs = async (filters: Parameters<typeof countItems>[2]) => {
      const rows = await listItemRows(database, place, { ...plainList, filters });
      expect(await countItems(database, place, filters)).toBe(rows.length);
      return rows.map((row) => row.slug).sort();
    };

    expect(await slugs({})).toHaveLength(4);
    expect(await slugs({ search: "summer sale" })).toEqual(["sale"]);
    expect(await slugs({ search: "100%" })).toEqual(["sale"]);
    expect(await slugs({ search: "snake_case" })).toEqual(["under_score"]);
    expect(await slugs({ status: "published" })).toEqual(["sale"]);
    expect(await slugs({ collectionId: other.id })).toEqual(["under_score"]);
    expect(await slugs({ status: "published", search: "snake" })).toEqual([]);
  });

  it("finds only items with a client's changes waiting for review", async () => {
    const { database } = handle;
    const waiting = await addTestEntry(database, { slug: "waiting" });
    const approved = await addTestEntry(database, { slug: "approved" });
    await addTestEntry(database, { slug: "no-review" });
    const reviews = tableFor(database, clientReviewsTable);
    await insertReturning(database, reviews, { entryId: waiting.id, status: "waiting" });
    await insertReturning(database, reviews, { entryId: approved.id, status: "approved" });
    const filters = { waitingForReview: true };

    const rows = await listItemRows(database, topOf(waiting), { ...plainList, filters });

    expect(rows.map((row) => row.id)).toEqual([waiting.id]);
    expect(await countItems(database, topOf(waiting), filters)).toBe(1);
  });

  it("lists the types at a place once each, by name", async () => {
    const { database } = handle;
    const parent = await addTestEntry(database, { slug: "parent" });
    const events = await addCollection(database, "events", { name: "Zebra events" });
    const news = await addCollection(database, "news", { name: "Apple news" });
    const unused = await addCollection(database, "unused", { name: "Unused" });
    for (const [slug, collectionId] of [
      ["one", events.id],
      ["two", events.id],
      ["three", news.id],
    ] as const) {
      await addTestEntry(database, { slug, collectionId, parentId: parent.id });
    }

    expect(await listTypesAt(database, { parentId: parent.id })).toEqual([
      { id: news.id, handle: "news", name: "Apple news" },
      { id: events.id, handle: "events", name: "Zebra events" },
    ]);
    expect(await listTypesAt(database, { entryIds: [] })).toEqual([]);
    expect(await listTypesAt(database, { ...topOf(parent), collectionId: unused.id })).toEqual([]);
  });

  it("lists sibling ids in their order", async () => {
    const { database } = handle;
    const third = await addTestEntry(database, { slug: "third", sortOrder: 2 });
    const second = await addTestEntry(database, {
      slug: "second",
      sortOrder: 1,
      createdAt: secondDay,
    });
    const first = await addTestEntry(database, {
      slug: "first",
      sortOrder: 1,
      createdAt: firstDay,
    });
    const child = await addTestEntry(database, { slug: "child", parentId: first.id });

    expect(await listSiblingIds(database, topOf(third))).toEqual([first.id, second.id, third.id]);
    expect(await listSiblingIds(database, { parentId: first.id })).toEqual([child.id]);
    expect(await listSiblingIds(database, { entryIds: [] })).toEqual([]);
  });

  it("renumbers siblings, changing only the rows that moved", async () => {
    const { database } = handle;
    const first = await addTestEntry(database, { slug: "first", sortOrder: 0 });
    const second = await addTestEntry(database, { slug: "second", sortOrder: 1 });
    const third = await addTestEntry(database, { slug: "third", sortOrder: 2 });

    await renumberSiblings(database, [first.id, third.id, second.id, randomUUID()], null);

    expect(await findEntryRow(database, first.id)).toMatchObject({
      sortOrder: 0,
      version: first.version,
    });
    expect(await findEntryRow(database, third.id)).toMatchObject({
      sortOrder: 1,
      version: third.version + 1,
    });
    expect(await findEntryRow(database, second.id)).toMatchObject({
      sortOrder: 2,
      version: second.version + 1,
    });
  });

  it("moves entries to a new parent as it renumbers them", async () => {
    const { database } = handle;
    const parent = await addTestEntry(database, { slug: "parent", sortOrder: 5 });
    const child = await addTestEntry(database, { slug: "child", sortOrder: 0 });

    await renumberSiblings(database, [child.id], parent.id);
    expect(await findEntryRow(database, child.id)).toMatchObject({
      parentId: parent.id,
      sortOrder: 0,
      version: child.version + 1,
    });

    await renumberSiblings(database, [child.id], null);
    expect((await findEntryRow(database, child.id))?.parentId).toBeNull();

    await renumberSiblings(database, [], parent.id);
    expect((await findEntryRow(database, parent.id))?.sortOrder).toBe(5);
  });

  it("lists direct children in their order", async () => {
    const { database } = handle;
    const parent = await addTestEntry(database, { slug: "parent" });
    const otherParent = await addTestEntry(database, { slug: "other-parent" });
    const second = await addTestEntry(database, {
      slug: "second",
      parentId: parent.id,
      sortOrder: 1,
    });
    const first = await addTestEntry(database, {
      slug: "first",
      parentId: parent.id,
      sortOrder: 0,
    });
    const other = await addTestEntry(database, {
      slug: "other",
      parentId: otherParent.id,
      sortOrder: 2,
    });
    await addTestEntry(database, { slug: "below", parentId: first.id });

    expect(await listChildLinks(database, [parent.id, otherParent.id])).toEqual([
      { id: first.id, parentId: parent.id },
      { id: second.id, parentId: parent.id },
      { id: other.id, parentId: otherParent.id },
    ]);
    expect(await listChildLinks(database, [])).toEqual([]);
  });

  it("finds nodes by id, leaving out those that aren't there", async () => {
    const { database } = handle;
    const entry = await addTestEntry(database, { data: { title: "Found" } });

    const rows = await findNodeRows(database, [entry.id, randomUUID()]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: entry.id, title: "Found", collectionHandle: "pages" });
    expect(await findNodeRows(database, [])).toEqual([]);
  });

  it("searches titles, putting those that start with the words first", async () => {
    const { database } = handle;
    const entry = await addTestEntry(database, {
      slug: "inside-newest",
      updatedAt: fourthDay,
      data: { title: "The Summer sale" },
    });
    await addTestEntry(database, {
      slug: "start-older",
      updatedAt: firstDay,
      data: { title: "SUMMER news" },
    });
    await addTestEntry(database, {
      slug: "start-newer",
      updatedAt: secondDay,
      data: { title: "summer fair" },
    });
    await addTestEntry(database, {
      slug: "inside-older",
      updatedAt: thirdDay,
      data: { title: "Late summer" },
    });
    await addTestEntry(database, { slug: "no-match", data: { title: "Winter" } });
    await addTestEntry(database, { slug: "french", locale: "fr-FR", data: { title: "summer" } });
    const otherSite = await addTestSite(database, "second");
    await addTestEntry(database, {
      slug: "elsewhere",
      siteId: otherSite.id,
      data: { title: "summer" },
    });
    const search = (text: string, limit = 10) =>
      searchNodeRows(database, text, entry.siteId, "en-GB", limit);

    const rows = await search("summer");
    expect(rows.map((row) => row.slug)).toEqual([
      "start-newer",
      "start-older",
      "inside-newest",
      "inside-older",
    ]);
    expect(rows[0]?.title).toBe("summer fair");

    const limited = await search("summer", 1);
    expect(limited.map((row) => row.slug)).toEqual(["start-newer"]);
    expect(await search("nothing")).toEqual([]);
  });

  it("takes % and _ literally in a search", async () => {
    const { database } = handle;
    const entry = await addTestEntry(database, { slug: "percent", data: { title: "100% off" } });
    await addTestEntry(database, { slug: "plain", data: { title: "100 off" } });
    await addTestEntry(database, { slug: "underscore", data: { title: "a_b" } });
    await addTestEntry(database, { slug: "letter", data: { title: "aXb" } });
    const search = async (text: string) => {
      const rows = await searchNodeRows(database, text, entry.siteId, "en-GB", 10);
      return rows.map((row) => row.slug);
    };

    expect(await search("100%")).toEqual(["percent"]);
    expect(await search("a_b")).toEqual(["underscore"]);
  });

  it("lists one tenant's sites, oldest first", async () => {
    const { database } = handle;
    const sites = tableFor(database, sitesTable);
    const add = (handleName: string, createdAt: Date, tenantId = "default") =>
      insertReturning(database, sites, {
        tenantId,
        handle: handleName,
        name: handleName,
        domain: `${handleName}.test`,
        locale: "fr-FR",
        createdAt,
      });
    const [newer] = await add("newer", secondDay);
    const [older] = await add("older", firstDay);
    await add("other", firstDay, "other");

    expect(await listSites(database, "default")).toEqual([
      { id: older?.id, name: "older", locale: "fr-FR" },
      { id: newer?.id, name: "newer", locale: "fr-FR" },
    ]);
    expect(await listSites(database, "nobody")).toEqual([]);
  });

  it("finds what mentions an entry, newest change first, leaving out itself", async () => {
    const { database } = handle;
    const id = randomUUID();
    const entry = await addTestEntry(database, {
      id,
      slug: "target",
      data: { self: id },
    });
    await addTestEntry(database, {
      slug: "saved",
      updatedAt: firstDay,
      data: { link: { entry: id } },
    });
    await addTestEntry(database, {
      slug: "published",
      updatedAt: secondDay,
      publishedData: { links: [id] },
    });
    await addTestEntry(database, { slug: "inside-text", data: { body: `see ${id} here` } });
    await addTestEntry(database, { slug: "other", data: { link: randomUUID() } });

    const rows = await findNodesMentioning(database, entry.id, 10);
    expect(rows.map((row) => row.slug)).toEqual(["published", "saved"]);

    const limited = await findNodesMentioning(database, entry.id, 1);
    expect(limited.map((row) => row.slug)).toEqual(["published"]);
  });

  it("finds people's names", async () => {
    const { database } = handle;
    const user = await addTestUser(database);

    expect(await findPersonNames(database, [user.id, randomUUID()])).toEqual(
      new Map([[user.id, "Ada"]]),
    );
    expect(await findPersonNames(database, [])).toEqual(new Map());
  });
});
