import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ensureBlogPostsCollection,
  ensurePagesCollection,
} from "../collections/default-collections.js";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";

describe("the recycle bin", () => {
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

  async function create(title: string, parentId?: string, slug?: string): Promise<string> {
    const response = await api("POST", "/collections/pages/entries", {
      data: { title },
      parentId,
      slug,
    });
    expect(response.statusCode, response.body).toBe(201);
    return response.json().id;
  }

  async function recycle(entryId: string) {
    const response = await api("POST", `/content-tree/entries/${entryId}/recycle`);
    expect(response.statusCode, response.body).toBe(201);
    return response.json() as { itemId: string; entryIds: string[] };
  }

  it("takes an entry and everything under it off the site and out of the tree", async () => {
    const home = await create("Home");
    const about = await create("About", home);
    const team = await create("Team", about);
    await api("POST", `/content-tree/entries/${home}/publish`, { includeDescendants: true });
    const deleted: string[] = [];
    server.events.onEvery("test listener", (event) => {
      if (event.name === "entry.deleted") deleted.push(event.name);
    });

    const binned = await recycle(about);

    expect(binned.entryIds).toEqual([about, team]);
    expect(deleted).toHaveLength(2);
    expect((await api("GET", `/entries/${team}`)).statusCode).toBe(404);
    expect((await api("GET", `/content-tree/children?parentId=${home}`)).json().total).toBe(0);
    expect((await api("GET", "/delivery/pages/about")).statusCode).toBe(404);
    expect((await api("GET", "/content-tree")).json().recycleBinCount).toBe(1);
    expect((await api("GET", "/recycle-bin")).json().items).toMatchObject([
      {
        entryId: about,
        title: "About",
        itemCount: 2,
        collection: { handle: "pages", name: "Pages" },
        deletedBy: { name: expect.any(String) },
      },
    ]);
  });

  it("restores a branch under its old parent, with its history, as drafts", async () => {
    const home = await create("Home");
    const about = await create("About", home);
    const team = await create("Team", about);
    await api("PATCH", `/entries/${about}`, { data: { summary: "Who we are" }, saveVersion: true });
    await api("POST", `/entries/${about}/publish`);
    const history = (await api("GET", `/entries/${about}/revisions`)).json().revisions;
    const { itemId } = await recycle(about);

    const restored = await api("POST", `/recycle-bin/${itemId}/restore`);

    expect(restored.json()).toEqual({ entryId: about, parentId: home, restoredCount: 2 });
    const entry = (await api("GET", `/entries/${about}`)).json();
    expect(entry).toMatchObject({
      parentId: home,
      status: "draft",
      slug: "about",
      data: { summary: "Who we are" },
    });
    expect((await api("GET", `/entries/${team}`)).json().parentId).toBe(about);
    expect((await api("GET", `/entries/${about}/revisions`)).json().revisions).toEqual(history);
    expect((await api("GET", "/recycle-bin")).json().items).toEqual([]);
  });

  it("restores at the top when the old parent is gone, renumbering a slug taken meanwhile", async () => {
    const home = await create("Home");
    const about = await create("About", home);
    const { itemId: aboutItem } = await recycle(about);
    await recycle(home);
    await create("About");

    const restored = await api("POST", `/recycle-bin/${aboutItem}/restore`);

    expect(restored.json().parentId).toBeNull();
    expect((await api("GET", `/entries/${about}`)).json()).toMatchObject({
      parentId: null,
      slug: "about-2",
    });
  });

  // LINTEL-DATA-012: binning an entry unlinked its translations for good.
  it("links an entry's translations to it again when it is restored", async () => {
    await api("POST", "/locales", { code: "fr-FR", name: "Français" });
    const about = await create("About");
    const french = await api("POST", `/entries/${about}/translations`, { locale: "fr-FR" });
    expect(french.statusCode, french.body).toBe(201);
    const frenchId: string = french.json().id;

    const { itemId } = await recycle(about);
    expect((await api("GET", `/entries/${frenchId}`)).json().originId).toBeNull();

    const restored = await api("POST", `/recycle-bin/${itemId}/restore`);
    expect(restored.statusCode, restored.body).toBe(200);
    expect((await api("GET", `/entries/${frenchId}`)).json().originId).toBe(about);
    expect((await api("GET", `/entries/${about}`)).json().translations).toEqual([
      expect.objectContaining({ id: frenchId, locale: "fr-FR" }),
    ]);
  });

  it("gives a site start its own domain back when it is restored", async () => {
    await create("Home");
    const shop = await create("Shop");
    const saved = await api("PUT", `/content-tree/entries/${shop}/hostnames`, {
      hostname: "shop.example.com",
    });
    expect(saved.statusCode, saved.body).toBe(200);
    const { itemId } = await recycle(shop);

    await api("POST", `/recycle-bin/${itemId}/restore`);

    expect((await api("GET", `/content-tree/entries/${shop}/hostnames`)).json()).toMatchObject({
      hostname: "shop.example.com",
      isAssigned: true,
      url: "https://shop.example.com/",
    });
  });

  it("deletes one item for good, or empties the whole bin after", async () => {
    const [first, second, third] = [
      await create("One"),
      await create("Two"),
      await create("Three"),
    ];
    const { itemId } = await recycle(first);
    await recycle(second);
    await recycle(third);

    const one = await api("DELETE", `/recycle-bin/${itemId}`);
    const emptied = await api("DELETE", "/recycle-bin");
    const gone = await api("POST", `/recycle-bin/${itemId}/restore`);

    expect(one.statusCode).toBe(204);
    expect(emptied.json()).toEqual({ deleted: 2 });
    expect(gone.json()).toMatchObject({ statusCode: 404, code: "NOT_FOUND" });
  });

  it("lets Authors bin only their own entries", async () => {
    await createTestUser(testDatabase.database, "sam@example.com", [
      ["entries:read", "entries:create", "entries:delete-own"],
    ]);
    const sam = requestsAs(server, await signInAndGetCookies(server, "sam@example.com"));
    const anas = await create("Ana's page");
    const own = await sam("POST", "/collections/pages/entries", { data: { title: "Sam's page" } });

    const notTheirs = await sam("POST", `/content-tree/entries/${anas}/recycle`);
    const theirs = await sam("POST", `/content-tree/entries/${own.json().id}/recycle`);
    const emptying = await sam("DELETE", "/recycle-bin");

    expect(notTheirs.statusCode).toBe(403);
    expect(theirs.statusCode).toBe(201);
    expect(emptying.statusCode).toBe(403);
  });
});
