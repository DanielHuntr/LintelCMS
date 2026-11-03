import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ensureBlogPostsCollection,
  ensurePagesCollection,
} from "../collections/default-collections.js";
import { findCollectionByHandle } from "../collections/collections.repository.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { entriesTable } from "../entries/entries.table.js";
import { findSiteWithLocales } from "../sites/locales.service.js";
import { useTestDatabase } from "../testing/test-database.js";
import { createHomePage } from "../testing/test-home-page.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";

describe("the content tree", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let api: SendRequest;

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase);
    await ensurePagesCollection(testDatabase.database);
    await ensureBlogPostsCollection(testDatabase.database);
    await createTestUser(testDatabase.database, "ana@example.com", [["*"]]);
    api = requestsAs(server, await signInAndGetCookies(server, "ana@example.com"));
  });

  afterEach(() => server.close());

  async function create(collection: string, title: string, parentId?: string): Promise<string> {
    const response = await api("POST", `/collections/${collection}/entries`, {
      data: { title },
      parentId,
    });
    expect(response.statusCode, response.body).toBe(201);
    return response.json().id;
  }

  async function childTitles(query: string): Promise<string[]> {
    const response = await api("GET", `/content-tree/children?${query}`);
    expect(response.statusCode, response.body).toBe(200);
    return response.json().items.map((item: { title: string }) => item.title);
  }

  async function addLandingPages(): Promise<void> {
    await api("POST", "/blueprints", {
      handle: "landing_page",
      name: "Landing page",
      fields: [{ handle: "title", label: "Title", type: "text" }],
    });
    const created = await api("POST", "/collections", {
      handle: "landing_pages",
      name: "Landing pages",
      blueprintHandle: "landing_page",
      structure: "tree",
      allowedAtRoot: false,
      allowedChildren: [],
    });
    expect(created.statusCode, created.body).toBe(201);
    await api("PUT", "/collections/pages", { allowedChildren: ["pages", "landing_pages"] });
  }

  it("lists a section per collection, page trees first, with top-level counts", async () => {
    const home = await create("pages", "Home");
    await create("pages", "About", home);
    await create("posts", "Hello");

    const response = await api("GET", "/content-tree");

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      site: { name: "Default site", locale: "en-GB" },
      locale: "en-GB",
      recycleBinCount: 0,
      roots: [
        { handle: "pages", name: "Pages", childCount: 1, childrenAsCollection: false },
        { handle: "posts", name: "Blog posts", childCount: 1, childrenAsCollection: true },
      ],
    });
  });

  it("reads one level at a time, with child counts, statuses and paging", async () => {
    const home = await create("pages", "Home");
    const about = await create("pages", "About", home);
    await create("pages", "Team", about);
    await create("pages", "Contact", home);
    await api("POST", `/entries/${about}/publish`);
    await api("PATCH", `/entries/${about}`, { data: { summary: "Changed since" } });

    const level = await api("GET", `/content-tree/children?parentId=${home}`);
    const firstPage = await api("GET", `/content-tree/children?parentId=${home}&limit=1`);
    const top = await api("GET", "/content-tree/children?collection=pages");

    expect(level.json()).toMatchObject({
      total: 2,
      items: [
        {
          title: "About",
          status: "published",
          hasUnpublishedChanges: true,
          childCount: 1,
          collection: { handle: "pages", name: "Pages" },
        },
        { title: "Contact", status: "draft", hasUnpublishedChanges: false, childCount: 0 },
      ],
    });
    expect(firstPage.json()).toMatchObject({ total: 2, limit: 1, offset: 0 });
    expect(firstPage.json().items).toHaveLength(1);
    expect(top.json().items.map((item: { title: string }) => item.title)).toEqual(["Home"]);
    expect(top.json().items[0].childCount).toBe(2);
  });

  it("refuses a parent and a collection together, or neither", async () => {
    const both = await api(
      "GET",
      "/content-tree/children?collection=pages&parentId=" + crypto.randomUUID(),
    );
    const neither = await api("GET", "/content-tree/children");

    expect(both.statusCode).toBe(400);
    expect(neither.statusCode).toBe(400);
  });

  it("offers only the content types allowed at each place", async () => {
    await addLandingPages();
    const home = await create("pages", "Home");

    const underHome = await api("GET", `/content-tree/allowed-types?parentId=${home}`);
    const atTopOfPages = await api("GET", "/content-tree/allowed-types?collection=pages");
    const atTopOfLanding = await api("GET", "/content-tree/allowed-types?collection=landing_pages");
    const anywhereAtTop = await api("GET", "/content-tree/allowed-types");

    const handles = (response: { json: () => { types: { handle: string }[] } }) =>
      response.json().types.map((type) => type.handle);
    expect(handles(underHome)).toEqual(["landing_pages", "pages"]);
    expect(handles(atTopOfPages)).toEqual(["pages"]);
    expect(handles(atTopOfLanding)).toEqual([]);
    expect(handles(anywhereAtTop)).toEqual(["posts", "pages"]);
  });

  it("enforces allowed children and the top level on the server, across collections", async () => {
    await addLandingPages();
    const home = await create("pages", "Home");
    const offer = await create("landing_pages", "Spring offer", home);

    const atTop = await api("POST", "/collections/landing_pages/entries", {
      data: { title: "Loose" },
    });
    const pageUnderLanding = await api("POST", "/collections/pages/entries", {
      data: { title: "Nope" },
      parentId: offer,
    });
    const movedToTop = await api("POST", "/content-tree/move", {
      entryId: offer,
      parentId: null,
      index: 0,
    });

    expect(atTop.json()).toMatchObject({
      statusCode: 400,
      code: "PLACEMENT_NOT_ALLOWED",
      message: "Landing pages can't go at the top level. Put it under another page instead.",
    });
    expect(pageUnderLanding.json()).toMatchObject({
      code: "PLACEMENT_NOT_ALLOWED",
      message: "Pages can't go under an entry in Landing pages.",
    });
    expect(movedToTop.json().code).toBe("PLACEMENT_NOT_ALLOWED");
    expect(await childTitles(`parentId=${home}`)).toEqual(["Spring offer"]);
  });

  it("keeps saving an entry that sits where its content type no longer allows", async () => {
    const home = await create("pages", "Home");
    const about = await create("pages", "About", home);
    await api("PUT", "/collections/pages", { allowedChildren: [] });

    const saved = await api("PATCH", `/entries/${about}`, {
      data: { title: "About us" },
      parentId: home,
    });

    expect(saved.statusCode).toBe(200);
  });

  it("moves an entry under another, at a place, and says where it was for undo", async () => {
    const home = await create("pages", "Home");
    const about = await create("pages", "About", home);
    const contact = await create("pages", "Contact", home);
    const blog = await create("pages", "Blog");

    const moved = await api("POST", "/content-tree/move", {
      entryId: contact,
      parentId: blog,
      index: 0,
    });
    const reordered = await api("POST", "/content-tree/move", {
      entryId: blog,
      parentId: null,
      index: 0,
    });

    // Nothing here is live, so no address that anyone could have saved has changed.
    expect(moved.json()).toEqual({ previous: { parentId: home, index: 1 }, addressChanges: [] });
    expect(reordered.json()).toEqual({
      previous: { parentId: null, index: 1 },
      addressChanges: [],
    });
    expect(await childTitles("collection=pages")).toEqual(["Blog", "Home"]);
    expect(await childTitles(`parentId=${blog}`)).toEqual(["Contact"]);

    // Undo puts it back where it was.
    await api("POST", "/content-tree/move", { entryId: contact, parentId: home, index: 1 });
    expect(await childTitles(`parentId=${home}`)).toEqual(["About", "Contact"]);
    expect((await api("GET", `/entries/${about}`)).json().parentId).toBe(home);
  });

  it("won't move an entry under itself or its own children", async () => {
    const home = await create("pages", "Home");
    const about = await create("pages", "About", home);

    const response = await api("POST", "/content-tree/move", {
      entryId: home,
      parentId: about,
      index: 0,
    });

    expect(response.json().message).toBe("An entry can't be moved under one of its own children.");
  });

  // LINTEL-FUNC-017: a move put a page under a page on another site.
  it("won't move a page under a page on another site", async () => {
    const site = await api("POST", "/sites", {
      handle: "shop",
      name: "Shop",
      hostnames: ["shop.example.com"],
      defaultLocale: "en-GB",
    });
    expect(site.statusCode, site.body).toBe(201);
    const shop = requestsAs(server, await signInAndGetCookies(server, "ana@example.com"), {
      "lintel-site": "shop",
    });
    const shopHome = await shop("POST", "/collections/pages/entries", {
      data: { title: "Shop home" },
    });
    const about = await create("pages", "About");

    const response = await api("POST", "/content-tree/move", {
      entryId: about,
      parentId: shopHome.json().id,
      index: 0,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toMatch(/same site/);
  });

  it("sorts children, keeping any left out after the ones listed", async () => {
    const home = await create("pages", "Home");
    const [first, second, third] = [
      await create("pages", "First", home),
      await create("pages", "Second", home),
      await create("pages", "Third", home),
    ];

    const sorted = await api("POST", "/content-tree/sort", {
      parentId: home,
      order: [third, first],
    });
    const stranger = await api("POST", "/content-tree/sort", { parentId: home, order: [home] });
    const dated = await api("POST", "/content-tree/sort", {
      parentId: null,
      collection: "posts",
      order: [second],
    });

    expect(sorted.statusCode).toBe(200);
    expect(sorted.json()).toEqual({ addressChanges: [] });
    expect(await childTitles(`parentId=${home}`)).toEqual(["Third", "First", "Second"]);
    expect(stranger.statusCode).toBe(400);
    expect(dated.json().message).toContain("ordered by date");
  });

  it("publishes and unpublishes a branch, reporting what wasn't ready", async () => {
    const home = await create("pages", "Home");
    const about = await create("pages", "About", home);
    const team = await create("pages", "Team", about);

    const published = await api("POST", `/content-tree/entries/${home}/publish`, {
      includeDescendants: true,
    });
    const again = await api("POST", `/content-tree/entries/${home}/publish`, {
      includeDescendants: true,
    });
    const unpublished = await api("POST", `/content-tree/entries/${about}/unpublish`, {
      includeDescendants: true,
    });
    const onlyHome = await api("POST", `/content-tree/entries/${about}/publish`, {});

    expect(published.json()).toEqual({ changed: [home, about, team], skipped: [] });
    expect(again.json()).toEqual({ changed: [], skipped: [] });
    expect(unpublished.json()).toEqual({ changed: [about, team], skipped: [] });
    expect(onlyHome.json().changed).toEqual([about]);
    expect((await api("GET", `/entries/${team}`)).json().status).toBe("draft");
  });

  it("duplicates an entry with everything under it", async () => {
    const home = await create("pages", "Home");
    const about = await create("pages", "About", home);
    await create("pages", "Team", about);

    const response = await api("POST", `/content-tree/entries/${about}/duplicate`, {
      includeDescendants: true,
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ copied: 2, entry: { title: "About (copy)" } });
    expect(await childTitles(`parentId=${home}`)).toEqual(["About", "About (copy)"]);
    expect(await childTitles(`parentId=${response.json().entry.id}`)).toEqual(["Team"]);
  });

  it("finds entries by title, and the path down to one", async () => {
    const home = await create("pages", "Home");
    const about = await create("pages", "About us", home);
    const team = await create("pages", "Our team", about);

    const search = await api("GET", "/content-tree/search?search=ou");
    const path = await api("GET", `/content-tree/entries/${team}/path`);

    expect(search.json().items.map((item: { title: string }) => item.title)).toEqual([
      "Our team",
      "About us",
    ]);
    expect(path.json().path.map((step: { title: string }) => step.title)).toEqual([
      "Home",
      "About us",
      "Our team",
    ]);
  });

  it("tells the Info tab where an entry lives, who made it and what links to it", async () => {
    await createHomePage(api);
    const about = await create("pages", "About");
    await api("POST", "/blueprints", {
      handle: "promo",
      name: "Promo",
      fields: [
        { handle: "title", label: "Title", type: "text" },
        { handle: "links", label: "Links", type: "entries", options: { collections: ["pages"] } },
      ],
    });
    await api("POST", "/collections", {
      handle: "promos",
      name: "Promos",
      blueprintHandle: "promo",
      structure: "flat",
    });
    const promo = await api("POST", "/collections/promos/entries", {
      data: { title: "Summer", links: [about] },
    });
    expect(promo.statusCode, promo.body).toBe(201);

    const info = await api("GET", `/content-tree/entries/${about}/info`);

    expect(info.json()).toMatchObject({
      url: "/about",
      collection: { handle: "pages", name: "Pages" },
      createdBy: { name: expect.any(String) },
      usedBy: [{ title: "Summer", collection: { handle: "promos" } }],
    });
  });

  it("names the pages above an entry that aren't published, from the top down", async () => {
    const home = await create("pages", "Home");
    const about = await create("pages", "About us", home);
    const team = await create("pages", "Our team", about);
    const unpublishedAbove = async (id: string) =>
      (await api("GET", `/content-tree/entries/${id}/info`)).json().unpublishedAncestors;

    expect(await unpublishedAbove(team)).toEqual([
      { id: home, title: "Home" },
      { id: about, title: "About us" },
    ]);
    await api("POST", `/entries/${home}/publish`);
    expect(await unpublishedAbove(team)).toEqual([{ id: about, title: "About us" }]);
    expect(await unpublishedAbove(home)).toEqual([]);
  });

  it("acts on many entries at once from the collection view", async () => {
    const [first, second] = [await create("posts", "First"), await create("posts", "Second")];

    const published = await api("POST", "/content-tree/bulk", {
      action: "publish",
      entryIds: [first, second],
    });
    const recycled = await api("POST", "/content-tree/bulk", {
      action: "recycle",
      entryIds: [first],
    });
    const moved = await api("POST", "/content-tree/bulk", {
      action: "move",
      entryIds: [second],
      parentId: null,
    });

    expect(published.json().changed).toEqual([first, second]);
    expect(recycled.json().changed).toEqual([first]);
    expect(moved.json().skipped[0].reason).toContain("ordered by date");
    expect(await childTitles("collection=posts")).toEqual(["Second"]);
  });

  it("lists a collection with its chosen columns, searched, filtered and sorted", async () => {
    // The columns are the fields marked "Show in the list" in the content type.
    const post = (await api("GET", "/blueprints/post")).json();
    await api("PUT", "/blueprints/post", {
      name: post.name,
      fields: post.fields.map((field: { handle: string }) =>
        field.handle === "excerpt" ? { ...field, showInList: true } : field,
      ),
    });
    for (const [title, excerpt] of [
      ["Bread", "Crusty"],
      ["Apples", "Crisp"],
      ["Cheese", "Aged"],
    ]) {
      await api("POST", "/collections/posts/entries", { data: { title, excerpt } });
    }

    const byExcerpt = await api("GET", "/content-tree/items?collection=posts&sort=field:excerpt");
    const searched = await api("GET", "/content-tree/items?collection=posts&search=che");
    const paged = await api(
      "GET",
      "/content-tree/items?collection=posts&sort=title&perPage=2&page=2",
    );

    expect(byExcerpt.json()).toMatchObject({
      columns: [{ handle: "excerpt", label: "Excerpt" }],
      total: 3,
      canSortByHand: false,
    });
    expect(
      byExcerpt.json().items.map((item: { values: { excerpt: string } }) => item.values.excerpt),
    ).toEqual(["Aged", "Crisp", "Crusty"]);
    expect(searched.json().items.map((item: { title: string }) => item.title)).toEqual(["Cheese"]);
    expect(paged.json().items.map((item: { title: string }) => item.title)).toEqual(["Cheese"]);
  });

  it("checks each bulk action's own permission", async () => {
    await createTestUser(testDatabase.database, "reader@example.com", [["entries:read"]]);
    const reader = requestsAs(server, await signInAndGetCookies(server, "reader@example.com"));
    const post = await create("posts", "Hello");

    const response = await reader("POST", "/content-tree/bulk", {
      action: "publish",
      entryIds: [post],
    });

    expect(response.statusCode).toBe(403);
  });

  it("stays quick with ten thousand entries, reading a page of children at a time", async () => {
    const pages = await findCollectionByHandle(testDatabase.database, DEFAULT_TENANT_ID, "pages");
    const site = await findSiteWithLocales(testDatabase.database);
    const home = await create("pages", "Home");
    const rows = Array.from({ length: 10_000 }, (_, index) => ({
      collectionId: pages?.id ?? "",
      siteId: site.id,
      locale: "en-GB",
      parentId: home,
      slug: `page-${index}`,
      data: { title: `Page ${index}` },
      sortOrder: index,
    }));
    for (let start = 0; start < rows.length; start += 1000) {
      await testDatabase.database.insert(entriesTable).values(rows.slice(start, start + 1000));
    }

    const started = performance.now();
    const top = await api("GET", "/content-tree/children?collection=pages");
    const children = await api(
      "GET",
      `/content-tree/children?parentId=${home}&offset=9950&limit=100`,
    );
    const elapsed = performance.now() - started;

    expect(top.json().items[0]).toMatchObject({ title: "Home", childCount: 10_000 });
    expect(children.json()).toMatchObject({ total: 10_000, offset: 9950 });
    expect(children.json().items).toHaveLength(50);
    expect(children.json().items[0].title).toBe("Page 9950");
    // Generous, for slow test machines: the point is that it doesn't read every row.
    expect(elapsed).toBeLessThan(5000);
  }, 60_000);
});
