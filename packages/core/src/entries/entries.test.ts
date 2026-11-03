import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ensureBlogPostsCollection,
  ensurePagesCollection,
} from "../collections/default-collections.js";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";

const MISSING_ID = "00000000-0000-4000-8000-000000000000";

describe("entries", () => {
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

  function createPost(data: Record<string, unknown>, extra: Record<string, unknown> = {}) {
    return api("POST", "/collections/posts/entries", { data, ...extra });
  }

  it("creates a draft with a slug from the title, and returns it with its blueprint", async () => {
    const response = await createPost({
      title: "Café opening hours",
      excerpt: "Now open on Sundays",
    });

    expect(response.statusCode).toBe(201);
    const entry = response.json();
    expect(entry).toMatchObject({
      title: "Café opening hours",
      slug: "cafe-opening-hours",
      status: "draft",
      parentId: null,
      locale: "en-GB",
      originId: null,
      translations: [],
      publishedAt: null,
      scheduledFor: null,
      updatedBy: { name: "Ana Editor" },
      collectionHandle: "posts",
      hasUnpublishedChanges: false,
      data: {
        title: "Café opening hours",
        excerpt: "Now open on Sundays",
        featured_image: null,
        body: null,
        categories: null,
        tags: null,
      },
      blueprint: { handle: "post", version: 1 },
    });
    expect((await api("GET", `/entries/${entry.id}`)).json()).toEqual(entry);
  });

  it("returns a message for each field that needs attention, and saves nothing", async () => {
    const response = await createPost({
      title: "",
      excerpt: 12,
      categories: ["gossip"],
      featured_image: "not-an-id",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      statusCode: 400,
      code: "INVALID_REQUEST",
      error: "Bad Request",
      fields: {
        title: "Title is required",
        excerpt: "Excerpt should be text",
        categories: "Categories should be a list of terms",
        featured_image: "Featured image should be an image from the media library",
      },
    });
    expect(response.json().message).toContain("- title: Title is required");
    expect((await api("GET", "/collections/posts/entries")).json().total).toBe(0);
  });

  // LINTEL-UX-004: a 10,000-character title was accepted, and stretched lists sideways.
  it("keeps titles to 300 characters", async () => {
    const tooLong = await createPost({ title: "a".repeat(301) });
    const longest = await createPost({ title: "a".repeat(300) });

    expect(tooLong.statusCode).toBe(400);
    expect(tooLong.json().fields.title).toMatch(/300/);
    expect(longest.statusCode).toBe(201);
  });

  it("checks images with the media library's check", async () => {
    await server.close();
    const knownImage = "6f1c2a8e-4b3d-4c5e-9f00-0a1b2c3d4e5f";
    server = await startTestServer(testDatabase.activeDatabase, {
      assetExists: async (assetId) => assetId === knownImage,
    });
    api = requestsAs(server, await signInAndGetCookies(server, "ana@example.com"));

    const missing = await createPost({ title: "Hello", featured_image: MISSING_ID });
    const found = await createPost({ title: "Hello", featured_image: knownImage });

    expect(missing.json().fields).toEqual({
      featured_image: "The image chosen for Featured image is no longer in the media library",
    });
    expect(found.statusCode).toBe(201);
  });

  it("keeps slugs unique within the collection by numbering them", async () => {
    const first = await createPost({ title: "Hello world" });
    const second = await createPost({ title: "Hello, World!" });
    const third = await createPost({ title: "Hello world" });
    const page = await api("POST", "/collections/pages/entries", {
      data: { title: "Hello world" },
    });
    const symbols = await createPost({ title: "!!!" });

    expect([first, second, third].map((response) => response.json().slug)).toEqual([
      "hello-world",
      "hello-world-2",
      "hello-world-3",
    ]);
    // Another collection is another address space.
    expect(page.json().slug).toBe("hello-world");
    expect(symbols.json().slug).toBe("entry");
  });

  it("tidies a typed slug, and refuses one that is taken", async () => {
    const typed = await createPost({ title: "Hello" }, { slug: "My Fancy Slug" });
    const taken = await createPost({ title: "Other" }, { slug: "my-fancy-slug" });
    const empty = await createPost({ title: "Other" }, { slug: "%%%" });

    expect(typed.json().slug).toBe("my-fancy-slug");
    expect(taken.statusCode).toBe(400);
    expect(taken.json().fields).toEqual({
      slug: "Another entry in Blog posts already uses this address. Each one needs its own, even under a different parent page.",
    });
    expect(empty.json().fields).toEqual({ slug: "The slug needs at least one letter or number" });

    const other = await createPost({ title: "Other" });
    const renamed = await api("PATCH", `/entries/${other.json().id}`, { slug: "my-fancy-slug" });
    const keptOwn = await api("PATCH", `/entries/${typed.json().id}`, { slug: "my-fancy-slug" });
    expect(renamed.json().fields).toEqual({
      slug: "Another entry in Blog posts already uses this address. Each one needs its own, even under a different parent page.",
    });
    expect(keptOwn.statusCode).toBe(200);
  });

  it("saves only the fields sent, keeping the slug when the title changes", async () => {
    const created = await createPost({
      title: "First title",
      excerpt: "Keep me",
    });

    const saved = await api("PATCH", `/entries/${created.json().id}`, {
      data: { title: "Second title", tags: null },
    });

    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toMatchObject({
      title: "Second title",
      slug: "first-title",
      data: { title: "Second title", excerpt: "Keep me", tags: null },
    });
  });

  it("filters by status and searches titles", async () => {
    const tips = await createPost({ title: "10 tips for 100% better coffee" });
    await createPost({ title: "Coffee news" });
    await createPost({ title: "Tea time" });
    await api("POST", `/entries/${tips.json().id}/publish`);

    const search = await api("GET", "/collections/posts/entries?search=COFFEE");
    const percent = await api("GET", "/collections/posts/entries?search=100%25");
    const published = await api("GET", "/collections/posts/entries?status=published");
    const drafts = await api("GET", "/collections/posts/entries?status=draft&search=");

    expect(
      search
        .json()
        .entries.map((entry: { title: string }) => entry.title)
        .sort(),
    ).toEqual(["10 tips for 100% better coffee", "Coffee news"]);
    expect(percent.json().total).toBe(1);
    expect(published.json()).toMatchObject({ total: 1, entries: [{ id: tips.json().id }] });
    expect(drafts.json().total).toBe(2);
    expect((await api("GET", "/collections/posts/entries?status=archived")).statusCode).toBe(400);
  });

  it("lists dated collections newest first, a page at a time", async () => {
    for (const title of ["One", "Two", "Three"]) {
      await createPost({ title });
    }

    const firstPage = await api("GET", "/collections/posts/entries?perPage=2");
    const secondPage = await api("GET", "/collections/posts/entries?perPage=2&page=2");

    expect(firstPage.json()).toMatchObject({ total: 3, page: 1, perPage: 2 });
    expect(firstPage.json().entries.map((entry: { title: string }) => entry.title)).toEqual([
      "Three",
      "Two",
    ]);
    expect(secondPage.json().entries.map((entry: { title: string }) => entry.title)).toEqual([
      "One",
    ]);
  });

  it("deletes an entry, moving its child pages up to its parent", async () => {
    const about = await api("POST", "/collections/pages/entries", { data: { title: "About" } });
    const team = await api("POST", "/collections/pages/entries", {
      data: { title: "Team" },
      parentId: about.json().id,
    });
    const ana = await api("POST", "/collections/pages/entries", {
      data: { title: "Ana" },
      parentId: team.json().id,
    });

    const deleted = await api("DELETE", `/entries/${team.json().id}`);

    expect(deleted.statusCode).toBe(204);
    expect((await api("GET", `/entries/${team.json().id}`)).statusCode).toBe(404);
    expect((await api("GET", `/entries/${ana.json().id}`)).json().parentId).toBe(about.json().id);
  });

  it("answers 404 for entries that don't exist, whatever the id looks like", async () => {
    for (const id of [MISSING_ID, "not-a-uuid"]) {
      const response = await api("GET", `/entries/${id}`);
      expect(response.json()).toMatchObject({ statusCode: 404, code: "NOT_FOUND" });
    }
    expect((await api("PATCH", `/entries/${MISSING_ID}`, { data: {} })).statusCode).toBe(404);
    expect((await api("GET", "/collections/nope/entries")).statusCode).toBe(404);
  });

  it("needs the right entries permission for each action", async () => {
    await createTestUser(testDatabase.database, "writer@example.com", [
      ["entries:read", "entries:create", "entries:update"],
    ]);
    const writer = requestsAs(server, await signInAndGetCookies(server, "writer@example.com"));
    const created = await writer("POST", "/collections/posts/entries", { data: { title: "Mine" } });
    const id = created.json().id;

    const publish = await writer("POST", `/entries/${id}/publish`);
    const schedule = await writer("POST", `/entries/${id}/schedule`, {
      publishAt: "2099-01-01T09:00:00Z",
    });
    const remove = await writer("DELETE", `/entries/${id}`);

    expect(created.statusCode).toBe(201);
    expect(
      (await writer("PATCH", `/entries/${id}`, { data: { title: "Still mine" } })).statusCode,
    ).toBe(200);
    expect(publish.statusCode).toBe(403);
    expect(publish.json()).toMatchObject({ code: "PERMISSION_DENIED" });
    expect(publish.json().message).toContain("entries:publish");
    expect(schedule.statusCode).toBe(403);
    expect(remove.statusCode).toBe(403);
    expect((await server.inject({ method: "GET", url: `/entries/${id}` })).statusCode).toBe(401);
  });
});
