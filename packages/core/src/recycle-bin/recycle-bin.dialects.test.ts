import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import { collectionsTable } from "../collections/collections.table.js";
import type { Database } from "../database/client.js";
import { tableFor } from "../database/dialect/mysql-tables.js";
import { insertReturning } from "../database/dialect/writes.js";
import {
  addTestEntry,
  addTestSite,
  addTestUser,
  describeOnEveryDatabase,
  findEntryRow,
} from "../testing/every-database.js";
import { usersTable } from "../users/users.table.js";
import {
  countRecycleBinItems,
  deleteAllRecycleBinItems,
  deleteRecycleBinItem,
  findExistingEntryIds,
  findExistingUserIds,
  findRecycleBinItem,
  insertEntryRow,
  insertRecycleBinItem,
  insertRevisionRows,
  insertRootAddressRow,
  insertSeoRows,
  listEntryRows,
  listRecycleBinRows,
  listRevisionRows,
  listRootAddressRows,
  listSeoRows,
  listTranslationLinks,
  relinkTranslations,
} from "./recycle-bin.repository.js";
import type { BinnedBranch, BinnedEntry, NewRecycleBinItem } from "./recycle-bin.table.js";

const TENANT = "default";
const OTHER_TENANT = "other";
const noon = new Date("2026-11-04T12:00:00.125Z");
const later = new Date("2026-11-04T13:00:00.125Z");
const latest = new Date("2026-11-04T14:00:00.125Z");

function binnedEntry(siteId: string, values: Partial<BinnedEntry> = {}): BinnedEntry {
  return {
    id: randomUUID(),
    collectionId: randomUUID(),
    siteId,
    locale: "en-GB",
    originId: null,
    parentId: null,
    slug: "about",
    data: { title: "About" },
    sortOrder: 0,
    createdBy: null,
    updatedBy: null,
    createdAt: noon.toISOString(),
    updatedAt: noon.toISOString(),
    ...values,
  };
}

function branchOf(entries: BinnedEntry[], values: Partial<BinnedBranch> = {}): BinnedBranch {
  return { entries, revisions: [], seo: [], ...values };
}

/** The collection every test entry goes in, and the site they're on. */
async function addHome(database: Database) {
  const entry = await addTestEntry(database);
  return { collectionId: entry.collectionId, siteId: entry.siteId };
}

function addItem(
  database: Database,
  collectionId: string,
  siteId: string,
  values: Partial<NewRecycleBinItem> = {},
) {
  const entry = binnedEntry(siteId);
  return insertRecycleBinItem(database, {
    entryId: entry.id,
    collectionId,
    title: "About",
    itemCount: 1,
    branch: branchOf([entry]),
    ...values,
  });
}

describeOnEveryDatabase("Recycle bin", (handle) => {
  it("saves an item and gives back its whole branch", async () => {
    const { database } = handle;
    const { collectionId, siteId } = await addHome(database);
    const user = await addTestUser(database);
    const parentId = randomUUID();
    const root = binnedEntry(siteId, {
      parentId,
      data: { title: "Zoë’s “page”", blocks: [{ type: "text", on: true, size: 2 }], none: null },
      publishedAt: noon.toISOString(),
      publishedData: { title: "Live" },
      status: "published",
    });
    const branch = branchOf([root], {
      address: "/about",
      translations: [{ entryId: randomUUID(), originId: root.id }],
    });

    const item = await insertRecycleBinItem(database, {
      entryId: root.id,
      collectionId,
      parentId,
      title: "About",
      itemCount: 1,
      branch,
      deletedBy: user.id,
      deletedAt: noon,
    });

    expect(item).toMatchObject({
      tenantId: TENANT,
      entryId: root.id,
      parentId,
      itemCount: 1,
      deletedBy: user.id,
      deletedAt: noon,
    });
    expect(item.branch).toEqual(branch);
    expect(await findRecycleBinItem(database, TENANT, item.id)).toEqual(item);
    expect(await findRecycleBinItem(database, OTHER_TENANT, item.id)).toBeUndefined();
    expect(await findRecycleBinItem(database, TENANT, randomUUID())).toBeUndefined();
  });

  it("sets the time and leaves the rest empty when it isn't told them", async () => {
    const { database } = handle;
    const { collectionId, siteId } = await addHome(database);
    const item = await addItem(database, collectionId, siteId);
    expect(item).toMatchObject({ parentId: null, deletedBy: null });
    expect(item.deletedAt).toBeInstanceOf(Date);
  });

  it("refuses an item for a collection that doesn't exist", async () => {
    const { database } = handle;
    const { siteId } = await addHome(database);
    await expect(addItem(database, randomUUID(), siteId)).rejects.toThrow();
  });

  it("counts one tenant's items", async () => {
    const { database } = handle;
    const { collectionId, siteId } = await addHome(database);
    expect(await countRecycleBinItems(database, TENANT)).toBe(0);
    await addItem(database, collectionId, siteId);
    await addItem(database, collectionId, siteId);
    await addItem(database, collectionId, siteId, { tenantId: OTHER_TENANT });
    expect(await countRecycleBinItems(database, TENANT)).toBe(2);
    expect(await countRecycleBinItems(database, OTHER_TENANT)).toBe(1);
  });

  it("lists the newest first without their branches, up to the limit", async () => {
    const { database } = handle;
    const { collectionId, siteId } = await addHome(database);
    const user = await addTestUser(database);
    const middle = await addItem(database, collectionId, siteId, {
      title: "Middle",
      deletedBy: user.id,
      deletedAt: later,
    });
    const oldest = await addItem(database, collectionId, siteId, { deletedAt: noon });
    const newest = await addItem(database, collectionId, siteId, { deletedAt: latest });
    await addItem(database, collectionId, siteId, { tenantId: OTHER_TENANT });

    const rows = await listRecycleBinRows(database, TENANT, 10, null);
    expect(rows.map((row) => row.item.id)).toEqual([newest.id, middle.id, oldest.id]);
    expect(rows[1]).toEqual({
      item: {
        id: middle.id,
        tenantId: TENANT,
        entryId: middle.entryId,
        collectionId,
        parentId: null,
        title: "Middle",
        itemCount: 1,
        deletedBy: user.id,
        deletedAt: later,
      },
      collectionHandle: "pages",
      collectionName: "Pages",
      deletedByName: "Ada",
      address: null,
      childTitles: null,
    });
    expect(rows[0]?.deletedByName).toBeNull();

    const limited = await listRecycleBinRows(database, TENANT, 2, null);
    expect(limited.map((row) => row.item.id)).toEqual([newest.id, middle.id]);
  });

  it("reads the address, which can be missing or a JSON null", async () => {
    const { database } = handle;
    const { collectionId, siteId } = await addHome(database);
    const entry = binnedEntry(siteId);
    const add = (branch: BinnedBranch, deletedAt: Date) =>
      addItem(database, collectionId, siteId, { branch, deletedAt });
    await add(branchOf([entry], { address: "/about/üs" }), latest);
    await add(branchOf([entry], { address: null }), later);
    await add(branchOf([entry]), noon);

    const rows = await listRecycleBinRows(database, TENANT, 10, null);
    expect(rows.map((row) => row.address)).toEqual(["/about/üs", null, null]);
  });

  it("names the first three entries straight under an item", async () => {
    const { database } = handle;
    const { collectionId, siteId } = await addHome(database);
    const root = binnedEntry(siteId);
    const child = (title: string, parentId = root.id) =>
      binnedEntry(siteId, { parentId, data: { title } });
    const first = child("Zoë’s “first”");
    const branch = branchOf([
      root,
      first,
      child("Under the first", first.id),
      child("Second"),
      child("Third"),
      child("Fourth"),
    ]);
    await addItem(database, collectionId, siteId, { entryId: root.id, branch });

    const [row] = await listRecycleBinRows(database, TENANT, 10, null);
    expect(row?.childTitles).toEqual(["Zoë’s “first”", "Second", "Third"]);
  });

  it("gives a child with no title an empty place", async () => {
    const { database } = handle;
    const { collectionId, siteId } = await addHome(database);
    const root = binnedEntry(siteId);
    const branch = branchOf([
      root,
      binnedEntry(siteId, { parentId: root.id, data: {} }),
      binnedEntry(siteId, { parentId: root.id, data: { title: "Named" } }),
    ]);
    await addItem(database, collectionId, siteId, { entryId: root.id, branch });

    const [row] = await listRecycleBinRows(database, TENANT, 10, null);
    expect(row?.childTitles).toEqual([null, "Named"]);
  });

  it("keeps to the sites asked for, reading each item's first entry", async () => {
    const { database } = handle;
    const { collectionId, siteId } = await addHome(database);
    const second = await addTestSite(database, "second");
    const third = await addTestSite(database, "third");
    const onMain = await addItem(database, collectionId, siteId, { deletedAt: noon });
    const onSecond = await addItem(database, collectionId, second.id, { deletedAt: later });
    await addItem(database, collectionId, third.id);
    const empty = await insertRecycleBinItem(database, {
      entryId: randomUUID(),
      collectionId,
      title: "Empty",
      itemCount: 0,
      branch: branchOf([]),
    });

    const ids = async (siteIds: readonly string[] | null) =>
      (await listRecycleBinRows(database, TENANT, 10, siteIds)).map((row) => row.item.id);
    expect(await ids([siteId])).toEqual([onMain.id]);
    expect(await ids([siteId, second.id])).toEqual([onSecond.id, onMain.id]);
    expect(await ids([])).toEqual([]);
    expect(await ids(null)).toHaveLength(4);
    expect(await ids(null)).toContain(empty.id);
  });

  it("keeps an item when the person who binned it goes", async () => {
    const { database } = handle;
    const { collectionId, siteId } = await addHome(database);
    const user = await addTestUser(database);
    const item = await addItem(database, collectionId, siteId, { deletedBy: user.id });

    const users = tableFor(database, usersTable);
    await database.delete(users).where(eq(users.id, user.id));

    expect((await findRecycleBinItem(database, TENANT, item.id))?.deletedBy).toBeNull();
    const [row] = await listRecycleBinRows(database, TENANT, 10, null);
    expect(row).toMatchObject({ item: { deletedBy: null }, deletedByName: null });
  });

  it("empties with its collection", async () => {
    const { database } = handle;
    const { collectionId, siteId } = await addHome(database);
    const collections = tableFor(database, collectionsTable);
    const [pages] = await database
      .select()
      .from(collections)
      .where(eq(collections.id, collectionId));
    const [news] = await insertReturning(database, collections, {
      handle: "news",
      name: "News",
      blueprintId: pages?.blueprintId ?? "",
      routePattern: "/news/{slug}",
    });
    const newsId = news?.id ?? "";
    const gone = await addItem(database, newsId, siteId);
    const kept = await addItem(database, collectionId, siteId);

    await database.delete(collections).where(eq(collections.id, newsId));

    expect(await findRecycleBinItem(database, TENANT, gone.id)).toBeUndefined();
    expect(await findRecycleBinItem(database, TENANT, kept.id)).toBeDefined();
  });

  it("deletes one item", async () => {
    const { database } = handle;
    const { collectionId, siteId } = await addHome(database);
    const gone = await addItem(database, collectionId, siteId);
    const kept = await addItem(database, collectionId, siteId);

    await deleteRecycleBinItem(database, gone.id);
    await deleteRecycleBinItem(database, randomUUID());

    expect(await findRecycleBinItem(database, TENANT, gone.id)).toBeUndefined();
    expect(await findRecycleBinItem(database, TENANT, kept.id)).toBeDefined();
  });

  it("empties one tenant's bin and says how many went", async () => {
    const { database } = handle;
    const { collectionId, siteId } = await addHome(database);
    await addItem(database, collectionId, siteId);
    await addItem(database, collectionId, siteId);
    await addItem(database, collectionId, siteId, { tenantId: OTHER_TENANT });

    expect(await deleteAllRecycleBinItems(database, TENANT, null)).toBe(2);
    expect(await countRecycleBinItems(database, TENANT)).toBe(0);
    expect(await countRecycleBinItems(database, OTHER_TENANT)).toBe(1);
    expect(await deleteAllRecycleBinItems(database, TENANT, null)).toBe(0);
  });

  it("empties only the sites asked for", async () => {
    const { database } = handle;
    const { collectionId, siteId } = await addHome(database);
    const second = await addTestSite(database, "second");
    await addItem(database, collectionId, siteId);
    const kept = await addItem(database, collectionId, second.id);

    expect(await deleteAllRecycleBinItems(database, TENANT, [])).toBe(0);
    expect(await deleteAllRecycleBinItems(database, TENANT, [siteId])).toBe(1);
    const rows = await listRecycleBinRows(database, TENANT, 10, null);
    expect(rows.map((row) => row.item.id)).toEqual([kept.id]);
  });

  it("puts an entry back exactly as it was, and reads entries by id", async () => {
    const { database } = handle;
    const { collectionId, siteId } = await addHome(database);
    const user = await addTestUser(database);
    const parentId = randomUUID();
    const childId = randomUUID();
    await insertEntryRow(database, {
      id: parentId,
      collectionId,
      siteId,
      slug: "about",
      status: "published",
      publishedAt: noon,
      data: { title: "Draft", blocks: [{ on: true }] },
      publishedData: { title: "Live" },
      sortOrder: 4,
      createdBy: user.id,
      updatedBy: null,
      createdAt: noon,
      updatedAt: later,
    });
    await insertEntryRow(database, {
      id: childId,
      collectionId,
      siteId,
      parentId,
      slug: "team",
      scheduledFor: later,
    });

    const rows = await listEntryRows(database, [parentId, childId, randomUUID()]);
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.id === parentId)).toMatchObject({
      status: "published",
      publishedAt: noon,
      data: { title: "Draft", blocks: [{ on: true }] },
      publishedData: { title: "Live" },
      sortOrder: 4,
      createdBy: user.id,
      updatedBy: null,
      createdAt: noon,
      updatedAt: later,
    });
    expect(rows.find((row) => row.id === childId)).toMatchObject({
      parentId,
      status: "draft",
      data: {},
      publishedData: null,
      publishedAt: null,
      scheduledFor: later,
    });
    expect(await listEntryRows(database, [])).toEqual([]);
  });

  it("refuses an entry with a slug already taken", async () => {
    const { database } = handle;
    const { collectionId, siteId } = await addHome(database);
    await expect(
      insertEntryRow(database, { collectionId, siteId, slug: "home" }),
    ).rejects.toThrow();
  });

  it("lists translations outside a branch, with what they point at", async () => {
    const { database } = handle;
    const origin = await addTestEntry(database, { slug: "origin" });
    const inside = await addTestEntry(database, {
      slug: "origin-fr",
      locale: "fr-FR",
      originId: origin.id,
    });
    const outside = await addTestEntry(database, {
      slug: "origin-de",
      locale: "de-DE",
      originId: origin.id,
    });
    await addTestEntry(database, { slug: "unrelated" });

    expect(await listTranslationLinks(database, [origin.id, inside.id])).toEqual([
      { entryId: outside.id, originId: origin.id },
    ]);
    expect(await listTranslationLinks(database, [outside.id])).toEqual([]);
    expect(await listTranslationLinks(database, [])).toEqual([]);
  });

  it("links translations back, unless something else has since", async () => {
    const { database } = handle;
    const origin = await addTestEntry(database, { slug: "origin" });
    const other = await addTestEntry(database, { slug: "other" });
    const unlinked = await addTestEntry(database, { slug: "unlinked", locale: "fr-FR" });
    const relinked = await addTestEntry(database, {
      slug: "relinked",
      locale: "de-DE",
      originId: other.id,
    });

    await relinkTranslations(database, []);
    await relinkTranslations(database, [
      { entryId: unlinked.id, originId: origin.id },
      { entryId: relinked.id, originId: origin.id },
      { entryId: randomUUID(), originId: origin.id },
    ]);

    expect((await findEntryRow(database, unlinked.id))?.originId).toBe(origin.id);
    expect((await findEntryRow(database, relinked.id))?.originId).toBe(other.id);
  });

  it("saves revisions and lists them oldest first", async () => {
    const { database } = handle;
    const entry = await addTestEntry(database);
    const otherEntry = await addTestEntry(database, { slug: "other" });
    const user = await addTestUser(database);
    const [newerId, olderId] = [randomUUID(), randomUUID()];

    await insertRevisionRows(database, []);
    await insertRevisionRows(database, [
      {
        id: newerId,
        entryId: entry.id,
        kind: "restored",
        data: { title: "Newer", list: [1, 2] },
        restoredFromAt: noon,
        createdAt: later,
        updatedAt: latest,
      },
      {
        id: olderId,
        entryId: entry.id,
        authorId: user.id,
        kind: "published",
        data: {},
        createdAt: noon,
      },
      { entryId: otherEntry.id, data: { title: "Elsewhere" } },
    ]);

    const rows = await listRevisionRows(database, [entry.id]);
    expect(rows.map((row) => row.id)).toEqual([olderId, newerId]);
    expect(rows[1]).toMatchObject({
      kind: "restored",
      authorId: null,
      data: { title: "Newer", list: [1, 2] },
      isOpen: false,
      restoredFromAt: noon,
      createdAt: later,
      updatedAt: latest,
    });
    expect(rows[0]).toMatchObject({ authorId: user.id, restoredFromAt: null });
    expect(await listRevisionRows(database, [])).toEqual([]);
  });

  it("saves search engine settings and reads them by entry", async () => {
    const { database } = handle;
    const entry = await addTestEntry(database);
    const otherEntry = await addTestEntry(database, { slug: "other" });

    await insertSeoRows(database, []);
    await insertSeoRows(database, [
      { entryId: entry.id, title: "Zoë", description: "About", noindex: true },
      { entryId: otherEntry.id },
    ]);

    const rows = await listSeoRows(database, [entry.id]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      tenantId: TENANT,
      entryId: entry.id,
      title: "Zoë",
      description: "About",
      socialImageId: null,
      noindex: true,
    });
    const [defaults] = await listSeoRows(database, [otherEntry.id]);
    expect(defaults).toMatchObject({ title: "", description: "", noindex: false });
    expect(await listSeoRows(database, [])).toEqual([]);
    await expect(insertSeoRows(database, [{ entryId: entry.id }])).rejects.toThrow();
  });

  it("saves a site start's address and reads it by entry", async () => {
    const { database } = handle;
    const entry = await addTestEntry(database);
    const otherEntry = await addTestEntry(database, { slug: "other" });

    await insertRootAddressRow(database, {
      entryId: entry.id,
      hostname: "shop.example.com",
      pathPrefix: "/shop",
    });
    await insertRootAddressRow(database, { entryId: otherEntry.id });

    const rows = await listRootAddressRows(database, [entry.id]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      tenantId: TENANT,
      entryId: entry.id,
      hostname: "shop.example.com",
      pathPrefix: "/shop",
    });
    expect(await listRootAddressRows(database, [otherEntry.id])).toMatchObject([
      { hostname: "", pathPrefix: "" },
    ]);
    expect(await listRootAddressRows(database, [])).toEqual([]);
    await expect(insertRootAddressRow(database, { entryId: entry.id })).rejects.toThrow();
  });

  it("says which people and entries still exist", async () => {
    const { database } = handle;
    const user = await addTestUser(database);
    const entry = await addTestEntry(database);
    const [missingUser, missingEntry] = [randomUUID(), randomUUID()];

    expect(await findExistingUserIds(database, [user.id, missingUser])).toEqual(new Set([user.id]));
    expect(await findExistingUserIds(database, [])).toEqual(new Set());
    expect(await findExistingEntryIds(database, [entry.id, missingEntry])).toEqual(
      new Set([entry.id]),
    );
    expect(await findExistingEntryIds(database, [])).toEqual(new Set());
  });
});
