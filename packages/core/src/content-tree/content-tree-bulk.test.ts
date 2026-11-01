import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensurePagesCollection } from "../collections/default-collections.js";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";

/**
 * Selecting several pages in the tree or the list and acting on them at once: what a delete
 * would take, deleting to the recycle bin with Undo, and the list of every level.
 */
describe("acting on many pages at once", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let api: SendRequest;

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase);
    await ensurePagesCollection(testDatabase.database);
    await createTestUser(testDatabase.database, "ana@example.com", [["*"]]);
    api = requestsAs(server, await signInAndGetCookies(server, "ana@example.com"));
  });
  afterEach(() => server.close());

  async function create(title: string, parentId?: string, slug?: string): Promise<string> {
    const response = await api("POST", "/collections/pages/entries", {
      data: { title },
      parentId,
      slug,
    });
    expect(response.statusCode, response.body).toBe(201);
    return response.json().id;
  }

  async function buildSite() {
    const home = await create("Home");
    const about = await create("About", home);
    const team = await create("Team", about);
    const people = await create("People", team);
    const contact = await create("Contact", home);
    return { home, about, team, people, contact };
  }

  it("says what a delete would take, counting each page once", async () => {
    const site = await buildSite();
    const summary = await api("POST", "/content-tree/bulk/summary", {
      entryIds: [site.about, site.team, site.contact],
    });
    expect(summary.json()).toEqual({
      items: [
        { id: site.about, title: "About", descendantCount: 2 },
        { id: site.contact, title: "Contact", descendantCount: 0 },
      ],
      totalCount: 4,
    });
  });

  it("deletes to the recycle bin, and Undo restores every page", async () => {
    const site = await buildSite();
    const deleted = await api("POST", "/content-tree/bulk", {
      action: "recycle",
      entryIds: [site.about, site.team, site.contact],
    });
    expect(deleted.json()).toMatchObject({ changed: [site.about, site.contact], skipped: [] });
    const itemIds: string[] = deleted.json().recycleBinItemIds;
    expect(itemIds).toHaveLength(2);
    expect((await api("GET", `/content-tree/children?parentId=${site.home}`)).json().total).toBe(0);

    for (const itemId of itemIds) {
      expect((await api("POST", `/recycle-bin/${itemId}/restore`)).statusCode).toBe(200);
    }
    const back = (await api("GET", `/content-tree/children?parentId=${site.home}`)).json();
    expect(back.items.map((item: { title: string }) => item.title)).toEqual(["About", "Contact"]);
    expect((await api("GET", `/content-tree/children?parentId=${site.team}`)).json().total).toBe(1);
  });

  it("lists every level in the tree's order, with addresses, types and filters", async () => {
    const site = await buildSite();
    await api("POST", `/entries/${site.contact}/publish`);

    const all = (await api("GET", "/content-tree/items?collection=pages&allLevels=true")).json();
    expect(all.items.map((item: { title: string }) => item.title)).toEqual([
      "Home",
      "About",
      "Team",
      "People",
      "Contact",
    ]);
    expect(all.items.map((item: { url: string }) => item.url)).toEqual([
      "/",
      "/about",
      "/about/team",
      "/about/team/people",
      "/contact",
    ]);
    expect(all.types).toEqual([{ handle: "pages", name: "Pages" }]);

    const live = await api(
      "GET",
      `/content-tree/items?parentId=${site.home}&allLevels=true&status=published`,
    );
    expect(live.json().items.map((item: { title: string }) => item.title)).toEqual(["Contact"]);
    const otherType = await api("GET", "/content-tree/items?collection=pages&type=blog_posts");
    expect(otherType.json().total).toBe(0);
    const sorted = await api(
      "GET",
      "/content-tree/items?collection=pages&allLevels=true&sort=title&perPage=2",
    );
    expect(sorted.json()).toMatchObject({
      total: 5,
      items: [{ title: "About" }, { title: "Contact" }],
    });
  });

  it("publishes and moves what the list picked, keeping to the content types' rules", async () => {
    const site = await buildSite();
    const published = await api("POST", "/content-tree/bulk", {
      action: "publish",
      entryIds: [site.about, site.contact],
    });
    expect(published.json().changed).toEqual([site.about, site.contact]);
    const moved = await api("POST", "/content-tree/bulk", {
      action: "move",
      entryIds: [site.contact, site.home],
      parentId: site.about,
    });
    expect(moved.json().changed).toEqual([site.contact]);
    expect(moved.json().skipped).toEqual([
      expect.objectContaining({ id: site.home, title: "Home" }),
    ]);
  });

  it("refuses a second page at an address another page answers on", async () => {
    await create("Home");
    await api("POST", "/blueprints", {
      handle: "landing",
      name: "Landing page",
      fields: [{ handle: "title", label: "Title", type: "text" }],
    });
    await api("POST", "/collections", {
      handle: "landing_pages",
      name: "Landing pages",
      blueprintHandle: "landing",
      structure: "flat",
      routePattern: "/{slug}",
    });
    const about = await create("About");
    expect(about).toBeTruthy();
    // "About" at the top is a second site start, answering on "/about".
    const clash = await api("POST", "/collections/landing_pages/entries", {
      data: { title: "About" },
      slug: "about",
    });
    expect(clash.statusCode).toBe(409);
    expect(clash.json()).toMatchObject({
      code: "ADDRESS_TAKEN",
      fields: { slug: expect.stringContaining("already uses the address /about") },
    });
    const elsewhere = await api("POST", "/collections/landing_pages/entries", {
      data: { title: "About" },
      slug: "about-us",
    });
    expect(elsewhere.statusCode).toBe(201);
  });
});
