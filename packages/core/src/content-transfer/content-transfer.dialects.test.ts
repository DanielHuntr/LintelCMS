import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import { blueprintsTable } from "../blueprints/blueprints.table.js";
import { collectionsTable } from "../collections/collections.table.js";
import type { Database } from "../database/client.js";
import { tableFor } from "../database/dialect/mysql-tables.js";
import { insertReturning } from "../database/dialect/writes.js";
import { entriesTable, revisionsTable } from "../entries/entries.table.js";
import type { FieldDefinition } from "../fieldtypes/field-definition.schema.js";
import { globalSetsTable, globalValuesTable } from "../globals/globals.table.js";
import { assetsTable } from "../media/media.table.js";
import { navigationsTable } from "../navigation/navigation.table.js";
import { siteLocalesTable } from "../sites/locales.table.js";
import { sitesTable } from "../sites/sites.table.js";
import { taxonomiesTable, termsTable } from "../taxonomies/taxonomies.table.js";
import {
  addTestEntry,
  addTestSite,
  addTestUser,
  describeOnEveryDatabase,
  findEntryRow,
} from "../testing/every-database.js";
import {
  insertLocale,
  insertRevisions,
  linkEntry,
  listAssets,
  listBlueprints,
  listCollections,
  listEntries,
  listExistingRevisionIds,
  listGlobalSets,
  listGlobalValues,
  listLocales,
  listMenus,
  listRevisions,
  listSites,
  listTaxonomies,
  listTerms,
  upsertAsset,
  upsertBlueprint,
  upsertCollection,
  upsertEntry,
  upsertGlobalSet,
  upsertGlobalValues,
  upsertMenu,
  upsertTaxonomy,
  upsertTerm,
} from "./content-transfer.repository.js";

const firstDay = new Date("2026-11-01T10:00:00.125Z");
const secondDay = new Date("2026-11-02T10:00:00.125Z");
const titleField = { handle: "title", type: "text" } as unknown as FieldDefinition;
const summaryField = { handle: "summary", type: "text" } as unknown as FieldDefinition;

/** The first row of a write, for values that have to exist. */
function saved<Row>(rows: Row[]): Row {
  const [row] = rows;
  if (!row) throw new Error("The test row was not saved.");
  return row;
}

/** One row of everything an export reads, all in one tenant. */
async function addTenantContent(database: Database, tenantId: string) {
  const site = saved(
    await insertReturning(database, tableFor(database, sitesTable), {
      tenantId,
      handle: "main",
      name: `${tenantId} site`,
      domain: `${tenantId}.test`,
      hostnames: [`${tenantId}.test`, `www.${tenantId}.test`],
    }),
  );
  const locale = saved(
    await insertReturning(database, tableFor(database, siteLocalesTable), {
      tenantId,
      siteId: site.id,
      code: "en-GB",
      name: "English",
    }),
  );
  const blueprint = saved(
    await insertReturning(database, tableFor(database, blueprintsTable), {
      tenantId,
      handle: "page",
      name: "Page",
      kind: "entry",
      fields: [titleField],
    }),
  );
  const collection = saved(
    await insertReturning(database, tableFor(database, collectionsTable), {
      tenantId,
      handle: "pages",
      name: "Pages",
      blueprintId: blueprint.id,
      siteIds: [site.id],
      allowedChildren: ["pages"],
    }),
  );
  const taxonomy = saved(
    await insertReturning(database, tableFor(database, taxonomiesTable), {
      tenantId,
      handle: "topics",
      name: "Topics",
    }),
  );
  const term = saved(
    await insertReturning(database, tableFor(database, termsTable), {
      tenantId,
      taxonomyId: taxonomy.id,
      title: "News",
      slug: "news",
    }),
  );
  const globalSet = saved(
    await insertReturning(database, tableFor(database, globalSetsTable), {
      tenantId,
      handle: "settings",
      name: "Settings",
      fields: [titleField],
    }),
  );
  const globalValues = saved(
    await insertReturning(database, tableFor(database, globalValuesTable), {
      tenantId,
      globalSetId: globalSet.id,
      siteId: site.id,
      locale: "en-GB",
      data: { footer: "Hello" },
    }),
  );
  const menu = saved(
    await insertReturning(database, tableFor(database, navigationsTable), {
      tenantId,
      siteId: site.id,
      handle: "main",
      name: "Main",
    }),
  );
  const asset = saved(
    await insertReturning(database, tableFor(database, assetsTable), {
      tenantId,
      filename: "a.png",
      storageKey: `${tenantId}/a.png`,
      mimeType: "image/png",
      size: 10,
      contentHash: "hash",
    }),
  );
  const entry = saved(
    await insertReturning(database, tableFor(database, entriesTable), {
      tenantId,
      collectionId: collection.id,
      siteId: site.id,
      slug: "home",
      data: { title: "Home" },
    }),
  );
  const revision = saved(
    await insertReturning(database, tableFor(database, revisionsTable), {
      tenantId,
      entryId: entry.id,
      data: { title: "Home" },
    }),
  );
  return {
    site,
    locale,
    blueprint,
    collection,
    taxonomy,
    term,
    globalSet,
    globalValues,
    menu,
    asset,
    entry,
    revision,
  };
}

async function addBlueprint(database: Database) {
  return saved(
    await insertReturning(database, tableFor(database, blueprintsTable), {
      handle: "page",
      name: "Page",
      kind: "entry",
    }),
  );
}

async function addTaxonomy(database: Database) {
  return saved(
    await insertReturning(database, tableFor(database, taxonomiesTable), {
      handle: "topics",
      name: "Topics",
    }),
  );
}

async function addGlobalSet(database: Database) {
  return saved(
    await insertReturning(database, tableFor(database, globalSetsTable), {
      handle: "settings",
      name: "Settings",
    }),
  );
}

describeOnEveryDatabase("Content transfer", (handle) => {
  it("reads whole tables for one tenant, with their values as they were written", async () => {
    const { database } = handle;
    const mine = await addTenantContent(database, "default");
    await addTenantContent(database, "other");

    const sites = await listSites(database, "default");
    expect(sites.map((site) => site.id)).toEqual([mine.site.id]);
    expect(sites[0]?.hostnames).toEqual(["default.test", "www.default.test"]);

    const locales = await listLocales(database, "default");
    expect(locales.map((locale) => locale.id)).toEqual([mine.locale.id]);

    const blueprints = await listBlueprints(database, "default");
    expect(blueprints.map((blueprint) => blueprint.id)).toEqual([mine.blueprint.id]);
    expect(blueprints[0]?.fields).toEqual([titleField]);

    const collections = await listCollections(database, "default");
    expect(collections.map((collection) => collection.id)).toEqual([mine.collection.id]);
    expect(collections[0]).toMatchObject({
      siteIds: [mine.site.id],
      allowedChildren: ["pages"],
      allowedAtRoot: true,
      childrenAsCollection: false,
      routePattern: null,
    });

    const taxonomies = await listTaxonomies(database, "default");
    expect(taxonomies.map((taxonomy) => taxonomy.id)).toEqual([mine.taxonomy.id]);

    const terms = await listTerms(database, "default");
    expect(terms.map((term) => term.id)).toEqual([mine.term.id]);

    const globalSets = await listGlobalSets(database, "default");
    expect(globalSets.map((globalSet) => globalSet.id)).toEqual([mine.globalSet.id]);
    expect(globalSets[0]?.fields).toEqual([titleField]);

    const globalValues = await listGlobalValues(database, "default");
    expect(globalValues.map((values) => values.id)).toEqual([mine.globalValues.id]);
    expect(globalValues[0]?.data).toEqual({ footer: "Hello" });

    const menus = await listMenus(database, "default");
    expect(menus.map((menu) => menu.id)).toEqual([mine.menu.id]);
    expect(menus[0]).toMatchObject({
      items: [],
      source: "items",
      maxDepth: 3,
      pageTree: { includeHome: true, hiddenEntryIds: [], labels: {} },
    });

    const assets = await listAssets(database, "default");
    expect(assets.map((asset) => asset.id)).toEqual([mine.asset.id]);
    expect(assets[0]).toMatchObject({
      focalX: 0.5,
      focalY: 0.5,
      width: null,
      creditDetails: null,
      siteId: null,
    });

    const entries = await listEntries(database, "default");
    expect(entries.map((entry) => entry.id)).toEqual([mine.entry.id]);
    expect(entries[0]?.data).toEqual({ title: "Home" });
    expect(entries[0]?.publishedData).toBeNull();

    const revisions = await listRevisions(database, "default");
    expect(revisions.map((revision) => revision.id)).toEqual([mine.revision.id]);
    expect(revisions[0]?.data).toEqual({ title: "Home" });
  });

  it("finds nothing for a tenant with no rows", async () => {
    const { database } = handle;
    await addTenantContent(database, "default");
    expect(await listSites(database, "nobody")).toEqual([]);
    expect(await listEntries(database, "nobody")).toEqual([]);
    expect(await listRevisions(database, "nobody")).toEqual([]);
  });

  it("lists terms by title", async () => {
    const { database } = handle;
    const taxonomy = await addTaxonomy(database);
    const terms = tableFor(database, termsTable);
    for (const title of ["Pears", "Apples", "Oranges"]) {
      await insertReturning(database, terms, {
        taxonomyId: taxonomy.id,
        title,
        slug: title.toLowerCase(),
      });
    }

    const rows = await listTerms(database, "default");

    expect(rows.map((term) => term.title)).toEqual(["Apples", "Oranges", "Pears"]);
  });

  it("lists entries in their set order, then oldest first", async () => {
    const { database } = handle;
    await addTestEntry(database, { slug: "third", sortOrder: 2, createdAt: firstDay });
    await addTestEntry(database, { slug: "second", sortOrder: 1, createdAt: secondDay });
    await addTestEntry(database, { slug: "first", sortOrder: 1, createdAt: firstDay });

    const rows = await listEntries(database, "default");

    expect(rows.map((entry) => entry.slug)).toEqual(["first", "second", "third"]);
  });

  it("lists revisions oldest first", async () => {
    const { database } = handle;
    const entry = await addTestEntry(database);
    await insertRevisions(database, [
      { entryId: entry.id, data: { title: "Later" }, createdAt: secondDay },
      { entryId: entry.id, data: { title: "Earlier" }, createdAt: firstDay },
    ]);

    const rows = await listRevisions(database, "default");

    expect(rows.map((revision) => revision.data)).toEqual([
      { title: "Earlier" },
      { title: "Later" },
    ]);
    expect(rows[0]?.createdAt).toEqual(firstDay);
  });

  it("says which revisions already exist", async () => {
    const { database } = handle;
    const { revision } = await addTenantContent(database, "default");
    const unknown = randomUUID();

    expect(await listExistingRevisionIds(database, [revision.id, unknown])).toEqual(
      new Set([revision.id]),
    );
    expect(await listExistingRevisionIds(database, [unknown])).toEqual(new Set());
    expect(await listExistingRevisionIds(database, [])).toEqual(new Set());
  });

  it("adds a language once, keeping the name already there", async () => {
    const { database } = handle;
    const site = await addTestSite(database);

    await insertLocale(database, { siteId: site.id, code: "fr-FR", name: "French" });
    await insertLocale(database, { siteId: site.id, code: "fr-FR", name: "Français" });
    await insertLocale(database, { siteId: site.id, code: "de-DE", name: "German" });

    const rows = await listLocales(database, "default");
    expect(rows.map((locale) => [locale.code, locale.name]).sort()).toEqual([
      ["de-DE", "German"],
      ["fr-FR", "French"],
    ]);
  });

  it("adds a blueprint, then changes only its name and fields", async () => {
    const { database } = handle;
    const id = randomUUID();
    const blueprint = {
      id,
      handle: "post",
      name: "Post",
      kind: "entry" as const,
      fields: [titleField],
      updatedAt: firstDay,
    };
    await upsertBlueprint(database, blueprint, false);
    expect((await listBlueprints(database, "default"))[0]).toMatchObject(blueprint);

    await upsertBlueprint(
      database,
      { ...blueprint, handle: "changed", name: "Article", fields: [summaryField] },
      true,
    );

    const rows = await listBlueprints(database, "default");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id, handle: "post", name: "Article", fields: [summaryField] });
    expect(rows[0]?.updatedAt.getTime()).toBeGreaterThan(firstDay.getTime());
  });

  it("refuses to add a blueprint whose handle is taken", async () => {
    const { database } = handle;
    await addBlueprint(database);
    await expect(
      upsertBlueprint(
        database,
        { id: randomUUID(), handle: "page", name: "Again", kind: "entry" },
        false,
      ),
    ).rejects.toThrow();
  });

  it("adds a collection, then changes what an import may change", async () => {
    const { database } = handle;
    const first = await addBlueprint(database);
    const second = saved(
      await insertReturning(database, tableFor(database, blueprintsTable), {
        handle: "post",
        name: "Post",
        kind: "entry",
      }),
    );
    const id = randomUUID();
    const collection = {
      id,
      handle: "blog",
      name: "Blog",
      blueprintId: first.id,
      routePattern: "/blog/{slug}" as string | null,
      previewUrlPattern: "https://example.com/{slug}" as string | null,
      structure: "dated" as const,
      allowedAtRoot: false,
      childrenAsCollection: true,
      allowedChildren: ["blog"],
      updatedAt: firstDay,
    };
    await upsertCollection(database, collection, false);
    expect((await listCollections(database, "default"))[0]).toMatchObject(collection);

    await upsertCollection(
      database,
      {
        ...collection,
        handle: "changed",
        name: "News",
        blueprintId: second.id,
        routePattern: null,
        previewUrlPattern: null,
        structure: "flat",
        allowedAtRoot: true,
      },
      true,
    );

    const rows = await listCollections(database, "default");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id,
      handle: "blog",
      name: "News",
      blueprintId: second.id,
      routePattern: null,
      previewUrlPattern: null,
      structure: "flat",
      allowedAtRoot: false,
      childrenAsCollection: true,
    });
    expect(rows[0]?.updatedAt.getTime()).toBeGreaterThan(firstDay.getTime());
  });

  it("adds a taxonomy, then changes only its name", async () => {
    const { database } = handle;
    const id = randomUUID();
    const taxonomy = { id, handle: "topics", name: "Topics", updatedAt: firstDay };
    await upsertTaxonomy(database, taxonomy, false);
    await upsertTaxonomy(database, { ...taxonomy, handle: "changed", name: "Subjects" }, true);

    const rows = await listTaxonomies(database, "default");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id, handle: "topics", name: "Subjects", siteId: null });
    expect(rows[0]?.updatedAt.getTime()).toBeGreaterThan(firstDay.getTime());
  });

  it("adds a term, then changes only its title and description", async () => {
    const { database } = handle;
    const taxonomy = await addTaxonomy(database);
    const id = randomUUID();
    const term = {
      id,
      taxonomyId: taxonomy.id,
      title: "News",
      slug: "news",
      description: "All of it",
      updatedAt: firstDay,
    };
    await upsertTerm(database, term, false);
    expect((await listTerms(database, "default"))[0]).toMatchObject(term);

    await upsertTerm(
      database,
      { ...term, title: "Stories", slug: "changed", description: "" },
      true,
    );

    const rows = await listTerms(database, "default");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id, title: "Stories", slug: "news", description: "" });
    expect(rows[0]?.updatedAt.getTime()).toBeGreaterThan(firstDay.getTime());
  });

  it("adds a global set, then changes only its name and fields", async () => {
    const { database } = handle;
    const id = randomUUID();
    const globalSet = {
      id,
      handle: "footer",
      name: "Footer",
      fields: [titleField],
      updatedAt: firstDay,
    };
    await upsertGlobalSet(database, globalSet, false);
    expect((await listGlobalSets(database, "default"))[0]).toMatchObject(globalSet);

    await upsertGlobalSet(
      database,
      { ...globalSet, handle: "changed", name: "Bottom", fields: [] },
      true,
    );

    const rows = await listGlobalSets(database, "default");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id, handle: "footer", name: "Bottom", fields: [] });
    expect(rows[0]?.updatedAt.getTime()).toBeGreaterThan(firstDay.getTime());
  });

  it("adds a site's global values, then replaces them", async () => {
    const { database } = handle;
    const globalSet = await addGlobalSet(database);
    const site = await addTestSite(database);
    const place = { globalSetId: globalSet.id, siteId: site.id, locale: "en-GB" };

    await upsertGlobalValues(database, { ...place, data: { footer: "One", extra: 1 } });
    await upsertGlobalValues(database, { ...place, data: { footer: "Two" } });

    const rows = await listGlobalValues(database, "default");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ ...place, data: { footer: "Two" } });
  });

  it("keeps each site's and language's global values apart", async () => {
    const { database } = handle;
    const globalSet = await addGlobalSet(database);
    const first = await addTestSite(database);
    const second = await addTestSite(database, "second");
    const globalSetId = globalSet.id;

    await upsertGlobalValues(database, {
      globalSetId,
      siteId: first.id,
      locale: "en-GB",
      data: { footer: "First" },
    });
    await upsertGlobalValues(database, {
      globalSetId,
      siteId: first.id,
      locale: "fr-FR",
      data: { footer: "Premier" },
    });
    await upsertGlobalValues(database, {
      globalSetId,
      siteId: second.id,
      locale: "en-GB",
      data: { footer: "Second" },
    });

    const rows = await listGlobalValues(database, "default");
    expect(rows.map((row) => row.data.footer).sort()).toEqual(["First", "Premier", "Second"]);
  });

  it("adds a menu, then changes only its name, depth and items", async () => {
    const { database } = handle;
    const site = await addTestSite(database);
    const id = randomUUID();
    const menu = {
      id,
      siteId: site.id,
      handle: "footer",
      name: "Footer",
      maxDepth: 1,
      items: [],
      source: "pageTree" as const,
      updatedAt: firstDay,
    };
    await upsertMenu(database, menu, false);
    expect((await listMenus(database, "default"))[0]).toMatchObject(menu);

    await upsertMenu(
      database,
      { ...menu, handle: "changed", name: "Bottom", maxDepth: 2, source: "items" },
      true,
    );

    const rows = await listMenus(database, "default");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id,
      handle: "footer",
      name: "Bottom",
      maxDepth: 2,
      source: "pageTree",
    });
    expect(rows[0]?.updatedAt.getTime()).toBeGreaterThan(firstDay.getTime());
  });

  it("adds an asset, then changes only what editors can change", async () => {
    const { database } = handle;
    const id = randomUUID();
    const asset = {
      id,
      filename: "photo.jpg",
      storageKey: "photos/photo.jpg",
      mimeType: "image/jpeg",
      size: 2048,
      width: 800,
      height: 600,
      alt: "A photo",
      focalX: 0.25,
      focalY: 0.75,
      contentHash: "hash",
      updatedAt: firstDay,
    };
    await upsertAsset(database, asset, false);
    expect((await listAssets(database, "default"))[0]).toMatchObject(asset);

    await upsertAsset(
      database,
      {
        ...asset,
        filename: "renamed.jpg",
        storageKey: "changed",
        size: 1,
        alt: "",
        focalX: 0.5,
        focalY: 0.125,
      },
      true,
    );

    const rows = await listAssets(database, "default");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id,
      filename: "renamed.jpg",
      storageKey: "photos/photo.jpg",
      size: 2048,
      alt: "",
      focalX: 0.5,
      focalY: 0.125,
    });
    expect(rows[0]?.updatedAt.getTime()).toBeGreaterThan(firstDay.getTime());
  });

  it("adds an entry without its links, keeping its times and values", async () => {
    const { database } = handle;
    const parent = await addTestEntry(database, { slug: "parent" });
    const id = randomUUID();

    await upsertEntry(
      database,
      {
        id,
        collectionId: parent.collectionId,
        siteId: parent.siteId,
        parentId: parent.id,
        originId: parent.id,
        slug: "child",
        status: "published",
        publishedAt: firstDay,
        data: { title: "Child", nested: { list: [1, "two"] } },
        publishedData: { title: "Child" },
        sortOrder: 4,
        createdAt: firstDay,
        updatedAt: secondDay,
      },
      false,
    );

    expect(await findEntryRow(database, id)).toMatchObject({
      parentId: null,
      originId: null,
      slug: "child",
      status: "published",
      publishedAt: firstDay,
      scheduledFor: null,
      data: { title: "Child", nested: { list: [1, "two"] } },
      publishedData: { title: "Child" },
      sortOrder: 4,
      version: 1,
      createdAt: firstDay,
      updatedAt: secondDay,
    });
  });

  it("replaces an entry's values, leaving its links and who made it", async () => {
    const { database } = handle;
    const user = await addTestUser(database);
    const parent = await addTestEntry(database, { slug: "parent" });
    const entry = await addTestEntry(database, {
      slug: "child",
      parentId: parent.id,
      originId: parent.id,
      createdBy: user.id,
      status: "published",
      publishedAt: firstDay,
      data: { title: "Old" },
      publishedData: { title: "Old" },
      createdAt: firstDay,
    });

    await upsertEntry(
      database,
      {
        id: entry.id,
        collectionId: entry.collectionId,
        siteId: entry.siteId,
        locale: "fr-FR",
        slug: "renamed",
        status: "scheduled",
        publishedAt: null,
        scheduledFor: secondDay,
        data: { title: "New" },
        publishedData: null,
        sortOrder: 9,
        updatedAt: secondDay,
      },
      true,
    );

    expect(await findEntryRow(database, entry.id)).toMatchObject({
      parentId: parent.id,
      originId: parent.id,
      createdBy: user.id,
      locale: "fr-FR",
      slug: "renamed",
      status: "scheduled",
      publishedAt: null,
      scheduledFor: secondDay,
      data: { title: "New" },
      publishedData: null,
      sortOrder: 9,
      version: entry.version + 1,
      createdAt: firstDay,
      updatedAt: secondDay,
    });
  });

  it("links an entry to its parent and origin, and can clear them", async () => {
    const { database } = handle;
    const parent = await addTestEntry(database, { slug: "parent" });
    const origin = await addTestEntry(database, { slug: "origin" });
    const entry = await addTestEntry(database, { slug: "child" });

    await linkEntry(database, "default", entry.id, { parentId: parent.id, originId: origin.id });
    expect(await findEntryRow(database, entry.id)).toMatchObject({
      parentId: parent.id,
      originId: origin.id,
    });

    await linkEntry(database, "default", entry.id, { parentId: null, originId: origin.id });
    expect(await findEntryRow(database, entry.id)).toMatchObject({
      parentId: null,
      originId: origin.id,
    });
  });

  it("links only an entry of the tenant named", async () => {
    const { database } = handle;
    const parent = await addTestEntry(database, { slug: "parent" });
    const entry = await addTestEntry(database, { slug: "child" });

    await linkEntry(database, "other", entry.id, { parentId: parent.id, originId: null });

    expect((await findEntryRow(database, entry.id))?.parentId).toBeNull();
  });

  it("refuses a link to an entry that doesn't exist", async () => {
    const { database } = handle;
    const entry = await addTestEntry(database);
    await expect(
      linkEntry(database, "default", entry.id, { parentId: randomUUID(), originId: null }),
    ).rejects.toThrow();
  });

  it("adds several revisions at once, and nothing for an empty list", async () => {
    const { database } = handle;
    const user = await addTestUser(database);
    const entry = await addTestEntry(database);
    const id = randomUUID();

    await insertRevisions(database, []);
    expect(await listRevisions(database, "default")).toEqual([]);

    await insertRevisions(database, [
      {
        id,
        entryId: entry.id,
        authorId: user.id,
        kind: "restored",
        data: { title: "One", nested: { a: [1] } },
        isOpen: true,
        restoredFromAt: firstDay,
        createdAt: firstDay,
        updatedAt: secondDay,
      },
      { entryId: entry.id, data: {}, createdAt: secondDay },
    ]);

    const revisions = tableFor(database, revisionsTable);
    const [row] = await database.select().from(revisions).where(eq(revisions.id, id));
    expect(row).toMatchObject({
      entryId: entry.id,
      authorId: user.id,
      kind: "restored",
      data: { title: "One", nested: { a: [1] } },
      isOpen: true,
      restoredFromAt: firstDay,
      createdAt: firstDay,
      updatedAt: secondDay,
    });
    const rows = await listRevisions(database, "default");
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({
      authorId: null,
      kind: "edited",
      isOpen: false,
      restoredFromAt: null,
    });
  });
});
