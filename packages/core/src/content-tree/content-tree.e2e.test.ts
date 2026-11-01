import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensurePagesCollection } from "../collections/default-collections.js";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";

/**
 * The journey an editor takes in the Content section's tree, as the admin makes the calls:
 * create Home, then About under it through Create (offered only what is allowed there),
 * drag to reorder, publish with everything under it, delete, and restore from the bin.
 */
const JOURNEY_TIMEOUT = 60_000;

describe("building a site in the content tree", () => {
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

  const titles = async (query: string) =>
    (await api("GET", `/content-tree/children?${query}`))
      .json()
      .items.map((item: { title: string }) => item.title);

  it(
    "creates, reorders, publishes, deletes and restores pages",
    async () => {
      // A second kind of page that may only go under pages, and allows nothing under it.
      await api("POST", "/blueprints", {
        handle: "contact_page",
        name: "Contact page",
        fields: [{ handle: "title", label: "Title", type: "text" }],
      });
      await api("POST", "/collections", {
        handle: "contact_pages",
        name: "Contact pages",
        blueprintHandle: "contact_page",
        structure: "tree",
        routePattern: "/{slug}",
        allowedAtRoot: false,
        allowedChildren: [],
      });
      await api("PUT", "/collections/pages", { allowedChildren: ["pages", "contact_pages"] });

      // Create Home at the top of Pages: only Pages is offered there.
      const tree = (await api("GET", "/content-tree")).json();
      expect(tree.roots.map((root: { handle: string }) => root.handle)).toEqual(["pages"]);
      const atTop = (await api("GET", "/content-tree/allowed-types?collection=pages")).json();
      expect(atTop.types.map((type: { name: string }) => type.name)).toEqual(["Pages"]);
      const home = (
        await api("POST", "/collections/pages/entries", { data: { title: "Home" } })
      ).json().id;

      // Create under Home: both kinds of page are offered; under the contact page, nothing.
      const underHome = (await api("GET", `/content-tree/allowed-types?parentId=${home}`)).json();
      expect(underHome.types.map((type: { name: string }) => type.name)).toEqual([
        "Contact pages",
        "Pages",
      ]);
      const about = (
        await api("POST", "/collections/pages/entries", {
          data: { title: "About" },
          parentId: home,
        })
      ).json().id;
      const contact = (
        await api("POST", "/collections/contact_pages/entries", {
          data: { title: "Contact" },
          parentId: home,
        })
      ).json().id;
      const underContact = await api("GET", `/content-tree/allowed-types?parentId=${contact}`);
      expect(underContact.json().types).toEqual([]);
      expect(await titles(`parentId=${home}`)).toEqual(["About", "Contact"]);

      // Drag Contact above About, then undo and redo it.
      const moved = (
        await api("POST", "/content-tree/move", { entryId: contact, parentId: home, index: 0 })
      ).json();
      expect(await titles(`parentId=${home}`)).toEqual(["Contact", "About"]);
      await api("POST", "/content-tree/move", { entryId: contact, ...moved.previous });
      expect(await titles(`parentId=${home}`)).toEqual(["About", "Contact"]);
      await api("POST", "/content-tree/move", { entryId: contact, parentId: home, index: 0 });

      // Publish Home with everything under it: the site serves all three.
      const published = (
        await api("POST", `/content-tree/entries/${home}/publish`, { includeDescendants: true })
      ).json();
      expect(published.changed).toHaveLength(3);
      expect((await api("GET", "/delivery/pages/about")).statusCode).toBe(200);

      // Delete About: it goes to the bin and off the site.
      const { itemId } = (await api("POST", `/content-tree/entries/${about}/recycle`)).json();
      expect(await titles(`parentId=${home}`)).toEqual(["Contact"]);
      expect((await api("GET", "/delivery/pages/about")).statusCode).toBe(404);

      // Restore it: back under Home, as a draft until it is published again.
      const restored = (await api("POST", `/recycle-bin/${itemId}/restore`)).json();
      expect(restored).toMatchObject({ entryId: about, parentId: home });
      expect(await titles(`parentId=${home}`)).toEqual(["Contact", "About"]);
      expect((await api("GET", `/entries/${about}`)).json().status).toBe("draft");
      expect((await api("GET", "/recycle-bin")).json().items).toEqual([]);
    },
    JOURNEY_TIMEOUT,
  );
});
