import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ensureBlogPostsCollection,
  ensurePagesCollection,
} from "../collections/default-collections.js";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { orderAsTree } from "./entry-tree.js";

describe("orderAsTree", () => {
  it("puts each entry after its parent, siblings in order", () => {
    const at = (seconds: number) => new Date(seconds * 1000);
    const order = orderAsTree([
      { id: "contact", parentId: null, sortOrder: 2, createdAt: at(1) },
      { id: "team", parentId: "about", sortOrder: 0, createdAt: at(2) },
      { id: "about", parentId: null, sortOrder: 1, createdAt: at(3) },
      { id: "home", parentId: null, sortOrder: 0, createdAt: at(4) },
      { id: "orphan", parentId: "deleted", sortOrder: 0, createdAt: at(5) },
    ]);

    expect(order).toEqual(["home", "orphan", "about", "team", "contact"]);
  });
});

describe("ordering entries", () => {
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

  async function createPage(title: string, parentId?: string): Promise<string> {
    const response = await api("POST", "/collections/pages/entries", { data: { title }, parentId });
    expect(response.statusCode).toBe(201);
    return response.json().id;
  }

  async function pageTitles(query = ""): Promise<string[]> {
    const response = await api("GET", `/collections/pages/entries${query}`);
    return response.json().entries.map((entry: { title: string }) => entry.title);
  }

  it("lists a tree with each page followed by its children, new pages last", async () => {
    const about = await createPage("About");
    await createPage("Contact");
    await createPage("Team", about);
    await createPage("History", about);

    expect(await pageTitles()).toEqual(["About", "Team", "History", "Contact"]);
    expect(await pageTitles(`?parentId=${about}`)).toEqual(["Team", "History"]);
    expect(await pageTitles("?perPage=2&page=2")).toEqual(["History", "Contact"]);
  });

  it("reorders and re-parents a tree", async () => {
    const about = await createPage("About");
    const contact = await createPage("Contact");
    const team = await createPage("Team", about);

    const response = await api("POST", "/collections/pages/entries/reorder", {
      order: [
        { id: contact, parentId: null },
        { id: about, parentId: null },
        { id: team, parentId: contact },
      ],
    });

    expect(response.statusCode).toBe(204);
    expect(await pageTitles()).toEqual(["Contact", "Team", "About"]);
    expect((await api("GET", `/entries/${team}`)).json().parentId).toBe(contact);
  });

  it("refuses orders that would loop or leave the collection", async () => {
    const about = await createPage("About");
    const team = await createPage("Team", about);
    const post = (
      await api("POST", "/collections/posts/entries", { data: { title: "Post" } })
    ).json().id;

    const loop = await api("POST", "/collections/pages/entries/reorder", {
      order: [{ id: about, parentId: team }],
    });
    const stranger = await api("POST", "/collections/pages/entries/reorder", {
      order: [{ id: post, parentId: null }],
    });
    const dated = await api("POST", "/collections/posts/entries/reorder", {
      order: [{ id: post, parentId: null }],
    });
    const underItself = await api("PATCH", `/entries/${about}`, { parentId: team });
    const ownParent = await api("PATCH", `/entries/${about}`, { parentId: about });
    const otherCollectionParent = await api("POST", "/collections/pages/entries", {
      data: { title: "Odd" },
      parentId: post,
    });

    expect(loop.json()).toMatchObject({
      statusCode: 400,
      message: "An entry can't be moved under one of its own children.",
    });
    expect(stranger.json().message).toBe(`The entry ${post} isn't in Pages.`);
    expect(dated.json().message).toContain("ordered by date");
    expect(underItself.json().message).toBe(
      "An entry can't be moved under one of its own children.",
    );
    expect(ownParent.json().message).toBe("An entry can't be its own parent.");
    expect(otherCollectionParent.json().message).toBe(
      "The parent has to be another entry in Pages.",
    );
    expect(await pageTitles()).toEqual(["About", "Team"]);
  });

  it("orders a flat collection by hand, without parents", async () => {
    await api("POST", "/blueprints", {
      handle: "faq",
      name: "Question",
      fields: [{ handle: "title", label: "Question", type: "text" }],
    });
    await api("POST", "/collections", {
      handle: "faqs",
      name: "FAQs",
      blueprintHandle: "faq",
      structure: "flat",
    });
    const ids: string[] = [];
    for (const title of ["First", "Second", "Third"]) {
      ids.push((await api("POST", "/collections/faqs/entries", { data: { title } })).json().id);
    }

    await api("POST", "/collections/faqs/entries/reorder", {
      order: [ids[2], ids[0], ids[1]].map((id) => ({ id, parentId: null })),
    });
    const withParent = await api("POST", "/collections/faqs/entries/reorder", {
      order: [{ id: ids[0], parentId: ids[1] }],
    });

    const list = await api("GET", "/collections/faqs/entries");
    expect(list.json().entries.map((entry: { title: string }) => entry.title)).toEqual([
      "Third",
      "First",
      "Second",
    ]);
    expect(withParent.json().message).toBe("FAQs isn't a tree, so its entries can't have parents.");
  });

  it("flattens a tree when the collection stops being one", async () => {
    const about = await createPage("About");
    const team = await createPage("Team", about);

    await api("PUT", "/collections/pages", { structure: "flat" });

    expect((await api("GET", `/entries/${team}`)).json().parentId).toBeNull();
  });
});
