import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { saveSiteChoices } from "../setup/site-setup.service.js";
import { ensureBlogPostsCollection, ensurePagesCollection } from "./default-collections.js";

const titleField = { handle: "title", label: "Title", type: "text", required: true };

describe("collections", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let api: SendRequest;

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase);
    await createTestUser(testDatabase.database, "admin@example.com", [["*"]]);
    api = requestsAs(server, await signInAndGetCookies(server, "admin@example.com"));
    await api("POST", "/blueprints", {
      handle: "case_study",
      name: "Case study",
      fields: [titleField],
    });
  });

  afterEach(() => server.close());

  it("creates a collection with a route pattern made from its handle by default", async () => {
    const response = await api("POST", "/collections", {
      handle: "work",
      name: "Our work",
      blueprintHandle: "case_study",
      structure: "flat",
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      handle: "work",
      name: "Our work",
      blueprintHandle: "case_study",
      structure: "flat",
      routePattern: "/work/{slug}",
      entryCount: 0,
    });
    expect((await api("GET", "/collections/work")).json().id).toBe(response.json().id);
    expect((await api("GET", "/collections/nope")).statusCode).toBe(404);
  });

  it("checks the blueprint, structure, route pattern and handle", async () => {
    const unknownBlueprint = await api("POST", "/collections", {
      handle: "work",
      name: "Work",
      blueprintHandle: "missing",
      structure: "flat",
    });
    const badShape = await api("POST", "/collections", {
      handle: "work",
      name: "Work",
      blueprintHandle: "case_study",
      structure: "grid",
      routePattern: "/work/{id}",
    });
    await api("POST", "/collections", {
      handle: "work",
      name: "Work",
      blueprintHandle: "case_study",
      structure: "flat",
    });
    const taken = await api("POST", "/collections", {
      handle: "work",
      name: "Work",
      blueprintHandle: "case_study",
      structure: "flat",
    });

    expect(unknownBlueprint.statusCode).toBe(404);
    expect(badShape.statusCode).toBe(400);
    expect(badShape.json().message).toContain('The structure should be "tree", "dated" or "flat"');
    expect(badShape.json().message).toContain("The route pattern needs {slug} or {path} in it");
    expect(taken.json()).toMatchObject({ statusCode: 409, code: "COLLECTION_HANDLE_TAKEN" });
  });

  it("updates only what is sent, and counts entries", async () => {
    await api("POST", "/collections", {
      handle: "work",
      name: "Work",
      blueprintHandle: "case_study",
      structure: "flat",
    });
    await api("POST", "/collections/work/entries", { data: { title: "Acme rebrand" } });
    await api("POST", "/collections/work/entries", { data: { title: "Bistro site" } });

    const response = await api("PUT", "/collections/work", {
      name: "Case studies",
      routePattern: null,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      name: "Case studies",
      structure: "flat",
      routePattern: null,
      entryCount: 2,
    });
    const list = await api("GET", "/collections");
    expect(list.json().collections).toEqual([response.json()]);
  });

  it("only deletes a collection once it is empty", async () => {
    await api("POST", "/collections", {
      handle: "work",
      name: "Work",
      blueprintHandle: "case_study",
      structure: "flat",
    });
    const entry = await api("POST", "/collections/work/entries", {
      data: { title: "Acme rebrand" },
    });

    const refused = await api("DELETE", "/collections/work");
    await api("DELETE", `/entries/${entry.json().id}`);
    const deleted = await api("DELETE", "/collections/work");

    expect(refused.statusCode).toBe(409);
    expect(refused.json()).toMatchObject({
      code: "COLLECTION_NOT_EMPTY",
      message: "Work still has 1 entry. Delete them first, so nothing is lost by accident.",
    });
    expect(deleted.statusCode).toBe(204);
    expect((await api("GET", "/collections/work")).statusCode).toBe(404);
  });

  it("needs collections:read to look and collections:update to change", async () => {
    await createTestUser(testDatabase.database, "editor@example.com", [
      ["collections:read", "entries:*"],
    ]);
    const editor = requestsAs(server, await signInAndGetCookies(server, "editor@example.com"));

    expect((await editor("GET", "/collections")).statusCode).toBe(200);
    const create = await editor("POST", "/collections", {
      handle: "work",
      name: "Work",
      blueprintHandle: "case_study",
      structure: "flat",
    });
    expect(create.statusCode).toBe(403);
  });
});

describe("default collections", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let api: SendRequest;

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase);
    await createTestUser(testDatabase.database, "admin@example.com", [["*"]]);
    api = requestsAs(server, await signInAndGetCookies(server, "admin@example.com"));
  });

  afterEach(() => server.close());

  async function collectionHandles(): Promise<string[]> {
    const response = await api("GET", "/collections");
    return response.json().collections.map((collection: { handle: string }) => collection.handle);
  }

  it("makes Pages when setup finishes, and Blog posts when the blog is picked", async () => {
    await saveSiteChoices(testDatabase.database, server.plugins, {
      siteName: "Brightside",
      siteType: "blog",
    });

    expect(await collectionHandles()).toEqual(["posts", "pages"]);
    expect((await api("GET", "/collections/pages")).json()).toMatchObject({
      name: "Pages",
      structure: "tree",
      routePattern: "/{path}",
      blueprintHandle: "page",
    });
    expect((await api("GET", "/collections/posts")).json()).toMatchObject({
      name: "Blog posts",
      structure: "dated",
      routePattern: "/blog/{slug}",
      blueprintHandle: "post",
    });

    const page = await api("GET", "/blueprints/page");
    expect(
      page
        .json()
        .fields.map((field: { handle: string; type: string }) => [field.handle, field.type]),
    ).toEqual([
      ["title", "text"],
      ["summary", "textarea"],
      ["hero_image", "image"],
      ["body", "richText"],
      ["design", "page"],
    ]);
    const post = await api("GET", "/blueprints/post");
    expect(post.json().fields.map((field: { handle: string }) => field.handle)).toEqual([
      "title",
      "excerpt",
      "featured_image",
      "body",
      "categories",
      "tags",
    ]);
    expect(post.json().fields[4].options).toEqual({ taxonomy: "categories", maxItems: 3 });
    const categories = await api("GET", "/taxonomies/categories/terms");
    expect(categories.json().terms.map((term: { title: string }) => term.title)).toEqual([
      "Guides",
      "News",
      "Updates",
    ]);
  });

  it("adds Blog posts when the blog is switched on later, and keeps them when it is switched off", async () => {
    await saveSiteChoices(testDatabase.database, server.plugins, {
      siteName: "Brightside",
      siteType: "business",
    });
    expect(await collectionHandles()).toEqual(["pages"]);

    await api("PUT", "/plugins", { enabled: ["blog"] });
    expect(await collectionHandles()).toEqual(["posts", "pages"]);
    await api("POST", "/collections/posts/entries", { data: { title: "Hello" } });

    await api("PUT", "/plugins", { enabled: [] });
    expect(await collectionHandles()).toEqual(["posts", "pages"]);
    expect((await api("GET", "/collections/posts")).json().entryCount).toBe(1);
  });

  it("can run any number of times without changing what is there", async () => {
    await ensurePagesCollection(testDatabase.database);
    await api("PUT", "/blueprints/page", {
      name: "Page",
      fields: [{ handle: "title", label: "Page title", type: "text" }],
    });

    await ensurePagesCollection(testDatabase.database);
    await ensureBlogPostsCollection(testDatabase.database);
    await ensureBlogPostsCollection(testDatabase.database);
    await saveSiteChoices(testDatabase.database, server.plugins, {
      siteName: "Brightside",
      siteType: "blog",
    });

    expect(await collectionHandles()).toEqual(["posts", "pages"]);
    const page = await api("GET", "/blueprints/page");
    expect(page.json()).toMatchObject({ version: 2, fields: [{ label: "Page title" }] });
    expect((await api("GET", "/blueprints")).json().blueprints).toHaveLength(2);
  });
});
