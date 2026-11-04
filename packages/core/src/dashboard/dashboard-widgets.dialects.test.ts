import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import type { Database } from "../database/client.js";
import { tableFor } from "../database/dialect/mysql-tables.js";
import { insertAsset } from "../media/media.repository.js";
import type { NewAssetRow } from "../media/media.table.js";
import { addTestEntry, addTestUser, describeOnEveryDatabase } from "../testing/every-database.js";
import { usersTable } from "../users/users.table.js";
import {
  countEntries,
  listEntriesEditedBy,
  listEntriesNeedingAttention,
  listRecentlyEditedEntries,
  listScheduledEntries,
  summariseMedia,
} from "./dashboard-widgets.repository.js";

const TENANT = "default";
const OTHER_TENANT = "other";
const FIRST = new Date("2026-06-01T10:00:00.123Z");
const SECOND = new Date("2026-06-01T11:00:00.123Z");
const THIRD = new Date("2026-06-01T12:00:00.123Z");

function addAsset(database: Database, values: Partial<NewAssetRow> = {}) {
  return insertAsset(database, {
    filename: "photo.png",
    storageKey: randomUUID(),
    mimeType: "image/png",
    size: 100,
    alt: "A photo",
    contentHash: randomUUID(),
    ...values,
  });
}

function addPublished(database: Database, slug: string, data: Record<string, unknown>) {
  return addTestEntry(database, { slug, status: "published", data, publishedData: data });
}

function slugsOf(rows: Array<{ id: string }>, entries: Array<{ id: string; slug: string }>) {
  return rows.map((row) => entries.find((entry) => entry.id === row.id)?.slug);
}

describeOnEveryDatabase("Dashboard widgets", (handle) => {
  it("describes an entry as the widgets show it", async () => {
    const { database } = handle;
    const user = await addTestUser(database);
    const entry = await addTestEntry(database, {
      data: { title: "Home" },
      updatedBy: user.id,
      updatedAt: FIRST,
    });
    expect(await listRecentlyEditedEntries(database, TENANT, 10)).toEqual([
      {
        id: entry.id,
        title: "Home",
        status: "draft",
        collectionHandle: "pages",
        collectionName: "Pages",
        updatedAt: FIRST,
        scheduledFor: null,
        updatedByName: "Ada",
        hasUnpublishedChanges: false,
      },
    ]);
  });

  it("reads titles of every kind out of the entry", async () => {
    const { database } = handle;
    const titles = [
      ["quotes", `Bob's "best" page`, `Bob's "best" page`],
      ["accents", "Café ☕ Malmö", "Café ☕ Malmö"],
      ["escapes", "one\ntwo\tthree \\ four", "one\ntwo\tthree \\ four"],
      ["empty", "", ""],
      ["json-null", null, null],
      ["number", 42, "42"],
      ["word-null", "null", "null"],
    ] as const;
    for (const [slug, title] of titles) {
      await addTestEntry(database, { slug, data: { title } });
    }
    await addTestEntry(database, { slug: "no-title", data: {} });

    const rows = await listRecentlyEditedEntries(database, TENANT, 20);
    expect(rows).toHaveLength(titles.length + 1);
    const found = rows.map((row) => row.title);
    for (const [, , expected] of titles) {
      expect(found).toContain(expected);
    }
    expect(found.filter((title) => title === null)).toHaveLength(2);
  });

  it("lists recent edits newest first, up to the limit, within a tenant", async () => {
    const { database } = handle;
    const entries = [
      await addTestEntry(database, { slug: "first", updatedAt: FIRST }),
      await addTestEntry(database, { slug: "third", updatedAt: THIRD }),
      await addTestEntry(database, { slug: "second", updatedAt: SECOND }),
      await addTestEntry(database, { slug: "theirs", tenantId: OTHER_TENANT, updatedAt: THIRD }),
    ];
    const rows = await listRecentlyEditedEntries(database, TENANT, 2);
    expect(slugsOf(rows, entries)).toEqual(["third", "second"]);
    const theirs = await listRecentlyEditedEntries(database, OTHER_TENANT, 10);
    expect(slugsOf(theirs, entries)).toEqual(["theirs"]);
  });

  it("lists what one person edited, and forgets them when they go", async () => {
    const { database } = handle;
    const ada = await addTestUser(database);
    const grace = await addTestUser(database, "grace@example.com");
    const entries = [
      await addTestEntry(database, { slug: "older", updatedBy: ada.id, updatedAt: FIRST }),
      await addTestEntry(database, { slug: "newer", updatedBy: ada.id, updatedAt: SECOND }),
      await addTestEntry(database, { slug: "newest", updatedBy: ada.id, updatedAt: THIRD }),
      await addTestEntry(database, { slug: "hers", updatedBy: grace.id, updatedAt: SECOND }),
      await addTestEntry(database, { slug: "nobody", updatedAt: SECOND }),
      await addTestEntry(database, {
        slug: "theirs",
        updatedBy: ada.id,
        tenantId: OTHER_TENANT,
      }),
    ];
    const rows = await listEntriesEditedBy(database, TENANT, ada.id, 10);
    expect(slugsOf(rows, entries)).toEqual(["newest", "newer", "older"]);
    expect(rows.every((row) => row.updatedByName === "Ada")).toBe(true);
    expect(await listEntriesEditedBy(database, TENANT, ada.id, 1)).toHaveLength(1);
    expect(await listEntriesEditedBy(database, TENANT, randomUUID(), 10)).toEqual([]);

    const users = tableFor(database, usersTable);
    await database.delete(users).where(eq(users.id, grace.id));
    const all = await listRecentlyEditedEntries(database, TENANT, 10);
    const hers = entries.find((entry) => entry.slug === "hers");
    expect(all.find((row) => row.id === hers?.id)?.updatedByName).toBeNull();
  });

  it("lists scheduled entries, soonest first, and counts them", async () => {
    const { database } = handle;
    const scheduled = { status: "scheduled" } as const;
    const entries = [
      await addTestEntry(database, { ...scheduled, slug: "later", scheduledFor: THIRD }),
      await addTestEntry(database, { ...scheduled, slug: "soon", scheduledFor: FIRST }),
      await addTestEntry(database, { ...scheduled, slug: "middle", scheduledFor: SECOND }),
      await addTestEntry(database, { ...scheduled, slug: "no-date" }),
      await addTestEntry(database, { slug: "a-draft", scheduledFor: FIRST }),
      await addTestEntry(database, {
        ...scheduled,
        slug: "theirs",
        scheduledFor: FIRST,
        tenantId: OTHER_TENANT,
      }),
    ];
    const rows = await listScheduledEntries(database, TENANT, 10);
    expect(slugsOf(rows, entries)).toEqual(["soon", "middle", "later"]);
    expect(rows[0]?.scheduledFor).toEqual(FIRST);
    expect(await listScheduledEntries(database, TENANT, 1)).toHaveLength(1);
    expect(await countEntries(database, TENANT, "scheduled")).toBe(3);
    expect(await countEntries(database, OTHER_TENANT, "scheduled")).toBe(1);
  });

  it("flags saved changes that aren't live, and only those", async () => {
    const { database } = handle;
    const changed = await addTestEntry(database, {
      slug: "changed",
      status: "published",
      data: { title: "New" },
      publishedData: { title: "Old" },
    });
    const clean = await addPublished(database, "clean", { title: "Same" });
    const draft = await addTestEntry(database, { slug: "draft", data: { title: "Draft" } });

    const rows = await listRecentlyEditedEntries(database, TENANT, 10);
    const flagFor = (id: string) => rows.find((row) => row.id === id)?.hasUnpublishedChanges;
    expect(flagFor(changed.id)).toBe(true);
    expect(flagFor(clean.id)).toBe(false);
    expect(flagFor(draft.id)).toBe(false);
  });

  it("doesn't take the order of keys for a change", async () => {
    const { database } = handle;
    await addTestEntry(database, {
      slug: "same",
      status: "published",
      data: { title: "Same", body: "Text", list: [{ a: 1, b: { y: 2, x: 3 } }] },
      publishedData: { list: [{ b: { x: 3, y: 2 }, a: 1 }], body: "Text", title: "Same" },
    });
    await addTestEntry(database, {
      slug: "lists-differ",
      status: "published",
      data: { list: [1, 2] },
      publishedData: { list: [2, 1] },
    });
    const rows = await listRecentlyEditedEntries(database, TENANT, 10);
    const flags = rows.map((row) => row.hasUnpublishedChanges);
    expect(flags.sort()).toEqual([false, true]);
    expect(await countEntries(database, TENANT, "needsAttention")).toBe(1);
  });

  it("lists drafts and unpublished changes, oldest first, and counts them", async () => {
    const { database } = handle;
    const entries = [
      await addTestEntry(database, { slug: "newest-draft", updatedAt: THIRD }),
      await addTestEntry(database, {
        slug: "oldest-change",
        status: "published",
        data: { title: "New" },
        publishedData: { title: "Old" },
        updatedAt: FIRST,
      }),
      await addTestEntry(database, {
        slug: "scheduled-change",
        status: "scheduled",
        data: { title: "New" },
        publishedData: { title: "Old" },
        updatedAt: SECOND,
      }),
      await addPublished(database, "clean", { title: "Same" }),
      await addTestEntry(database, {
        slug: "live-with-nothing-copied",
        status: "published",
        data: { title: "Same" },
      }),
      await addTestEntry(database, { slug: "theirs", tenantId: OTHER_TENANT }),
    ];
    const rows = await listEntriesNeedingAttention(database, TENANT, 10);
    expect(slugsOf(rows, entries)).toEqual(["oldest-change", "scheduled-change", "newest-draft"]);
    expect(await listEntriesNeedingAttention(database, TENANT, 2)).toHaveLength(2);
    expect(await countEntries(database, TENANT, "needsAttention")).toBe(3);
    expect(await countEntries(database, OTHER_TENANT, "needsAttention")).toBe(1);
  });

  it("gives empty lists and zeros for an empty site", async () => {
    const { database } = handle;
    expect(await listRecentlyEditedEntries(database, TENANT, 10)).toEqual([]);
    expect(await listScheduledEntries(database, TENANT, 10)).toEqual([]);
    expect(await listEntriesNeedingAttention(database, TENANT, 10)).toEqual([]);
    expect(await countEntries(database, TENANT, "scheduled")).toBe(0);
    expect(await countEntries(database, TENANT, "needsAttention")).toBe(0);
    expect(await summariseMedia(database, TENANT)).toEqual({
      fileCount: 0,
      totalBytes: 0,
      imageCount: 0,
      imagesWithoutAltText: 0,
    });
  });

  it("sums up a tenant's media", async () => {
    const { database } = handle;
    await addAsset(database, { size: 1000 });
    await addAsset(database, { size: 2_000_000_000, alt: "" });
    await addAsset(database, { size: 2_000_000_000, alt: "   " });
    await addAsset(database, { size: 5, mimeType: "application/pdf", alt: "" });
    await addAsset(database, { size: 7, tenantId: OTHER_TENANT, alt: "" });

    expect(await summariseMedia(database, TENANT)).toEqual({
      fileCount: 4,
      totalBytes: 4_000_001_005,
      imageCount: 3,
      imagesWithoutAltText: 2,
    });
    expect(await summariseMedia(database, OTHER_TENANT)).toEqual({
      fileCount: 1,
      totalBytes: 7,
      imageCount: 1,
      imagesWithoutAltText: 1,
    });
  });
});
