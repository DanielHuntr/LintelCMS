import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { blueprintsTable } from "../blueprints/blueprints.table.js";
import { collectionsTable } from "../collections/collections.table.js";
import type { Database } from "../database/client.js";
import { tableFor } from "../database/dialect/mysql-tables.js";
import { insertReturning } from "../database/dialect/writes.js";
import { sitesTable } from "../sites/sites.table.js";
import { addTestEntry, addTestSite, describeOnEveryDatabase } from "../testing/every-database.js";
import {
  countPublishedEntries,
  findDraftEntry,
  findPublishedEntryBySlug,
  findPublishedEntryLinks,
  listPublishedEntries,
  listPublishedTranslations,
} from "./delivery.repository.js";

const firstDay = new Date("2026-11-01T10:00:00.125Z");
const secondDay = new Date("2026-11-02T10:00:00.125Z");
const thirdDay = new Date("2026-11-03T10:00:00.125Z");
const everything = { limit: 50, offset: 0 };

async function addCollection(
  database: Database,
  handle: string,
  routePattern: string | null = null,
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
    routePattern,
  });
  if (!collection) throw new Error("The test collection was not saved.");
  return collection;
}

/** A collection and site, with the filter that asks for what's in them. */
async function addPlace(database: Database) {
  const collection = await addCollection(database, "news");
  const site = await addTestSite(database);
  return {
    collectionId: collection.id,
    siteId: site.id,
    filter: { collectionId: collection.id, siteId: site.id, locale: "en-GB" },
  };
}

describeOnEveryDatabase("Delivery", (handle) => {
  it("lists only published values, never the working copy", async () => {
    const { database } = handle;
    const { collectionId, siteId, filter } = await addPlace(database);
    const published = await addTestEntry(database, {
      collectionId,
      siteId,
      slug: "live",
      publishedAt: firstDay,
      data: { title: "Unpublished change" },
      publishedData: { title: "Live", tags: ["a"], nested: { count: 2 } },
    });
    await addTestEntry(database, { collectionId, siteId, slug: "draft", data: { title: "Draft" } });

    const rows = await listPublishedEntries(database, filter, false, everything);

    expect(rows).toEqual([
      {
        id: published.id,
        originId: null,
        locale: "en-GB",
        slug: "live",
        publishedAt: firstDay,
        publishedData: { title: "Live", tags: ["a"], nested: { count: 2 } },
      },
    ]);
    expect(await countPublishedEntries(database, filter)).toBe(1);
  });

  it("counts an entry published with no values at all", async () => {
    const { database } = handle;
    const { collectionId, siteId, filter } = await addPlace(database);
    await addTestEntry(database, { collectionId, siteId, publishedData: {} });

    const rows = await listPublishedEntries(database, filter, false, everything);

    expect(rows.map((row) => row.publishedData)).toEqual([{}]);
    expect(await countPublishedEntries(database, filter)).toBe(1);
  });

  it("keeps to one collection, site and language", async () => {
    const { database } = handle;
    const { collectionId, siteId, filter } = await addPlace(database);
    const otherCollection = await addCollection(database, "events");
    const otherSite = await addTestSite(database, "second");
    const publishedData = { title: "Live" };
    const wanted = await addTestEntry(database, { collectionId, siteId, publishedData });
    await addTestEntry(database, {
      collectionId: otherCollection.id,
      siteId,
      publishedData,
    });
    const onOtherSite = await addTestEntry(database, {
      collectionId,
      siteId: otherSite.id,
      publishedData,
    });
    await addTestEntry(database, { collectionId, siteId, locale: "fr-FR", publishedData });

    const rows = await listPublishedEntries(database, filter, false, everything);
    expect(rows.map((row) => row.id)).toEqual([wanted.id]);
    expect(await countPublishedEntries(database, filter)).toBe(1);

    const everySite = { collectionId, locale: "en-GB" };
    const onEverySite = await listPublishedEntries(database, everySite, false, everything);
    expect(onEverySite.map((row) => row.id).sort()).toEqual([wanted.id, onOtherSite.id].sort());
    expect(await countPublishedEntries(database, everySite)).toBe(2);
  });

  it("puts entries in their set order, then oldest first", async () => {
    const { database } = handle;
    const { collectionId, siteId, filter } = await addPlace(database);
    const publishedData = { title: "Live" };
    const add = (slug: string, sortOrder: number, createdAt: Date) =>
      addTestEntry(database, { collectionId, siteId, slug, sortOrder, createdAt, publishedData });
    await add("third", 2, firstDay);
    await add("second", 1, secondDay);
    await add("first", 1, firstDay);

    const rows = await listPublishedEntries(database, filter, false, everything);

    expect(rows.map((row) => row.slug)).toEqual(["first", "second", "third"]);
  });

  it("puts the newest first, with entries that have no date before the rest", async () => {
    const { database } = handle;
    const { collectionId, siteId, filter } = await addPlace(database);
    const publishedData = { title: "Live" };
    const add = (slug: string, publishedAt: Date | null, createdAt: Date) =>
      addTestEntry(database, { collectionId, siteId, slug, publishedAt, createdAt, publishedData });
    await add("oldest", firstDay, firstDay);
    await add("newest", thirdDay, firstDay);
    await add("no-date", null, firstDay);
    await add("same-day-older", secondDay, firstDay);
    await add("same-day-newer", secondDay, secondDay);

    const rows = await listPublishedEntries(database, filter, true, everything);

    expect(rows.map((row) => row.slug)).toEqual([
      "no-date",
      "newest",
      "same-day-newer",
      "same-day-older",
      "oldest",
    ]);
  });

  it("gives one page at a time", async () => {
    const { database } = handle;
    const { collectionId, siteId, filter } = await addPlace(database);
    for (const sortOrder of [0, 1, 2, 3]) {
      await addTestEntry(database, {
        collectionId,
        siteId,
        slug: `entry-${sortOrder}`,
        sortOrder,
        publishedData: {},
      });
    }

    const page = await listPublishedEntries(database, filter, false, { limit: 2, offset: 1 });

    expect(page.map((row) => row.slug)).toEqual(["entry-1", "entry-2"]);
    expect(await countPublishedEntries(database, filter)).toBe(4);
  });

  it("finds entries that chose a term in any of the fields named", async () => {
    const { database } = handle;
    const { collectionId, siteId, filter } = await addPlace(database);
    const termId = randomUUID();
    const add = (slug: string, publishedData: Record<string, unknown>, data = {}) =>
      addTestEntry(database, { collectionId, siteId, slug, data, publishedData });
    await add("in-first", { topics: [termId, randomUUID()] });
    await add("in-second", { tags: [randomUUID(), termId] });
    await add("in-another-field", { related: [termId] });
    await add("other-term", { topics: [randomUUID()] });
    await add("no-field", {});
    await add("plain-value", { topics: termId });
    await add("empty-list", { topics: [] });
    await add("only-in-draft", { topics: [] }, { topics: [termId] });

    const withTerm = { termId, fieldHandles: ["topics", "tags"] };
    const rows = await listPublishedEntries(database, { ...filter, withTerm }, false, everything);

    expect(rows.map((row) => row.slug).sort()).toEqual(["in-first", "in-second"]);
    expect(await countPublishedEntries(database, { ...filter, withTerm })).toBe(2);
  });

  it("finds a published entry by its slug, within the filter", async () => {
    const { database } = handle;
    const { collectionId, siteId, filter } = await addPlace(database);
    const termId = randomUUID();
    const entry = await addTestEntry(database, {
      collectionId,
      siteId,
      slug: "live",
      publishedAt: secondDay,
      publishedData: { title: "Live", topics: [termId] },
    });
    await addTestEntry(database, { collectionId, siteId, slug: "draft" });
    await addTestEntry(database, {
      collectionId,
      siteId,
      locale: "fr-FR",
      slug: "en-francais",
      publishedData: {},
    });

    const found = await findPublishedEntryBySlug(database, filter, "live");
    expect(found).toMatchObject({ id: entry.id, publishedAt: secondDay });
    expect(found?.publishedData).toEqual({ title: "Live", topics: [termId] });
    expect(await findPublishedEntryBySlug(database, filter, "draft")).toBeUndefined();
    expect(await findPublishedEntryBySlug(database, filter, "LIVE")).toBeUndefined();
    expect(await findPublishedEntryBySlug(database, filter, "en-francais")).toBeUndefined();
    const withOtherTerm = {
      ...filter,
      withTerm: { termId: randomUUID(), fieldHandles: ["topics"] },
    };
    expect(await findPublishedEntryBySlug(database, withOtherTerm, "live")).toBeUndefined();
  });

  it("finds a working copy by id or by address, published or not", async () => {
    const { database } = handle;
    const { collectionId, siteId } = await addPlace(database);
    const entry = await addTestEntry(database, {
      collectionId,
      siteId,
      slug: "draft",
      data: { title: "Working", list: [1] },
      publishedData: { title: "Live" },
      publishedAt: firstDay,
    });
    const expected = {
      id: entry.id,
      collectionId,
      siteId,
      originId: null,
      locale: "en-GB",
      slug: "draft",
      publishedAt: firstDay,
      data: { title: "Working", list: [1] },
    };
    const address = { collectionId, siteId, locale: "en-GB", slug: "draft" };

    expect(await findDraftEntry(database, { entryId: entry.id })).toEqual(expected);
    expect(await findDraftEntry(database, address)).toEqual(expected);
    expect(await findDraftEntry(database, { entryId: randomUUID() })).toBeUndefined();
    expect(await findDraftEntry(database, { ...address, locale: "fr-FR" })).toBeUndefined();
    expect(await findDraftEntry(database, { ...address, slug: "other" })).toBeUndefined();
  });

  it("lists an entry's published translations, oldest first", async () => {
    const { database } = handle;
    const root = await addTestEntry(database, {
      slug: "home",
      createdAt: secondDay,
      publishedData: { title: "Home" },
    });
    const french = await addTestEntry(database, {
      slug: "accueil",
      locale: "fr-FR",
      originId: root.id,
      createdAt: firstDay,
      publishedData: { title: "Accueil" },
    });
    await addTestEntry(database, { slug: "inicio", locale: "es-ES", originId: root.id });
    await addTestEntry(database, { slug: "stranger", publishedData: { title: "Other" } });

    const rows = await listPublishedTranslations(database, root.id);

    expect(rows.map((row) => row.id)).toEqual([french.id, root.id]);
    expect(rows[0]).toMatchObject({ originId: root.id, locale: "fr-FR" });
    expect(rows[0]?.publishedData).toEqual({ title: "Accueil" });
    expect(await listPublishedTranslations(database, randomUUID())).toEqual([]);
  });

  it("finds what a link needs, for entries and their published translations", async () => {
    const { database } = handle;
    const collection = await addCollection(database, "news", "/news/{slug}");
    const site = await addTestSite(database);
    const [frenchSite] = await insertReturning(database, tableFor(database, sitesTable), {
      handle: "france",
      name: "France",
      domain: "example.fr",
      pathPrefix: "/fr",
    });
    const root = await addTestEntry(database, {
      collectionId: collection.id,
      siteId: site.id,
      slug: "hello",
      publishedAt: firstDay,
      data: { title: "Not this one" },
      publishedData: { title: "Hello" },
    });
    const french = await addTestEntry(database, {
      collectionId: collection.id,
      siteId: frenchSite?.id,
      locale: "fr-FR",
      slug: "bonjour",
      originId: root.id,
      publishedData: { title: null },
    });
    await addTestEntry(database, {
      collectionId: collection.id,
      siteId: site.id,
      locale: "es-ES",
      slug: "hola",
      originId: root.id,
    });
    await addTestEntry(database, {
      collectionId: collection.id,
      siteId: site.id,
      slug: "stranger",
      publishedData: { title: "Other" },
    });

    const rows = await findPublishedEntryLinks(database, [root.id]);

    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.id === root.id)).toEqual({
      id: root.id,
      originId: null,
      locale: "en-GB",
      slug: "hello",
      title: "Hello",
      publishedAt: firstDay,
      collectionHandle: "news",
      routePattern: "/news/{slug}",
      pathPrefix: "",
    });
    expect(rows.find((row) => row.id === french.id)).toEqual({
      id: french.id,
      originId: root.id,
      locale: "fr-FR",
      slug: "bonjour",
      title: null,
      publishedAt: null,
      collectionHandle: "news",
      routePattern: "/news/{slug}",
      pathPrefix: "/fr",
    });
  });

  it("finds no links for no ids, or for an unpublished entry", async () => {
    const { database } = handle;
    const draft = await addTestEntry(database, { slug: "draft" });
    expect(await findPublishedEntryLinks(database, [])).toEqual([]);
    expect(await findPublishedEntryLinks(database, [draft.id])).toEqual([]);
  });
});
