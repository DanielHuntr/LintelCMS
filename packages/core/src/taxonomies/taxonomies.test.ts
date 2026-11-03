import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureBlogPostsCollection } from "../collections/default-collections.js";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { ensureBlogTaxonomies } from "./default-taxonomies.js";

describe("taxonomies and terms", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let api: SendRequest;

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase);
    await ensureBlogPostsCollection(testDatabase.database);
    await createTestUser(testDatabase.database, "ana@example.com", [["*"]]);
    api = requestsAs(server, await signInAndGetCookies(server, "ana@example.com"));
  });

  afterEach(() => server.close());

  async function termIds(taxonomy: string): Promise<Record<string, string>> {
    const { terms } = (await api("GET", `/taxonomies/${taxonomy}/terms`)).json();
    return Object.fromEntries(
      terms.map((term: { slug: string; id: string }) => [term.slug, term.id]),
    );
  }

  it("gives the blog Categories and Tags, once, however often it is switched on", async () => {
    await api("DELETE", `/terms/${(await termIds("categories")).updates}`);
    await ensureBlogTaxonomies(testDatabase.database);
    await ensureBlogPostsCollection(testDatabase.database);

    const response = await api("GET", "/taxonomies");

    expect(response.json().taxonomies).toEqual([
      expect.objectContaining({ handle: "categories", name: "Categories", termCount: 2 }),
      expect.objectContaining({ handle: "tags", name: "Tags", termCount: 0 }),
    ]);
  });

  it("creates, renames and deletes taxonomies", async () => {
    const created = await api("POST", "/taxonomies", { handle: "topics", name: "Topics" });
    const taken = await api("POST", "/taxonomies", { handle: "topics", name: "Again" });
    const renamed = await api("PUT", "/taxonomies/topics", { name: "Subjects" });
    const deleted = await api("DELETE", "/taxonomies/topics");

    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ handle: "topics", name: "Topics", termCount: 0 });
    expect(taken.json().code).toBe("TAXONOMY_HANDLE_TAKEN");
    expect(renamed.json().name).toBe("Subjects");
    expect(deleted.statusCode).toBe(204);
    expect((await api("GET", "/taxonomies/topics")).statusCode).toBe(404);
  });

  it("won't delete a taxonomy a content type still chooses from", async () => {
    const response = await api("DELETE", "/taxonomies/tags");

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: "TAXONOMY_IN_USE",
      message: "Tags is used by fields in Blog post. Remove those fields first.",
    });
  });

  it("makes term slugs from titles, numbered when taken, and checks typed ones", async () => {
    const recipes = await api("POST", "/taxonomies/tags/terms", { title: "Recipes & tips" });
    const again = await api("POST", "/taxonomies/tags/terms", { title: "Recipes & Tips!" });
    const typed = await api("POST", "/taxonomies/tags/terms", {
      title: "Other",
      slug: "recipes-and-tips",
    });
    const blank = await api("POST", "/taxonomies/tags/terms", { title: " " });

    expect(recipes.json()).toMatchObject({
      taxonomyHandle: "tags",
      title: "Recipes & tips",
      slug: "recipes-and-tips",
      description: "",
    });
    expect(again.json().slug).toBe("recipes-and-tips-2");
    expect(typed.json().fields).toEqual({
      slug: "Another term in this taxonomy already uses this address. Each one needs its own.",
    });
    expect(blank.statusCode).toBe(400);

    const edited = await api("PATCH", `/terms/${recipes.json().id}`, {
      title: "Recipes",
      description: "Things to cook",
    });
    expect(edited.json()).toMatchObject({
      title: "Recipes",
      slug: "recipes-and-tips",
      description: "Things to cook",
    });
  });

  it("lets posts choose terms, and takes a deleted term out of every post", async () => {
    const { news, guides } = await termIds("categories");
    const post = await api("POST", "/collections/posts/entries", {
      data: { title: "Hello", categories: [news, guides] },
    });
    await api("POST", `/entries/${post.json().id}/publish`);
    const wrongTaxonomy = await api("POST", "/collections/posts/entries", {
      data: { title: "Oops", tags: [news] },
    });

    expect(post.json().data.categories).toEqual([news, guides]);
    expect(wrongTaxonomy.json().fields).toEqual({
      tags: "Some of the terms chosen for Tags no longer exist",
    });

    await api("DELETE", `/terms/${news}`);

    const saved = (await api("GET", `/entries/${post.json().id}`)).json();
    expect(saved.data.categories).toEqual([guides]);
    expect(saved.hasUnpublishedChanges).toBe(false);
  });

  it("delivers terms, and posts filtered by a term with their terms expanded", async () => {
    const { news, guides } = await termIds("categories");
    const posts: Array<[string, string[]]> = [
      ["In the news", [news ?? ""]],
      ["How to", [guides ?? ""]],
      ["Both", [guides ?? "", news ?? ""]],
    ];
    for (const [title, categories] of posts) {
      const post = await api("POST", "/collections/posts/entries", {
        data: { title, categories },
      });
      await api("POST", `/entries/${post.json().id}/publish`);
    }
    const deliver = (url: string) => server.inject({ method: "GET", url });

    const categories = await deliver("/delivery/taxonomies/categories");
    const term = await deliver("/delivery/taxonomies/categories/news");
    const newsPosts = await deliver("/delivery/posts?taxonomy=categories&term=news");

    expect(categories.headers["cache-control"]).toBe("public, max-age=60");
    expect(categories.json()).toMatchObject({
      handle: "categories",
      name: "Categories",
      items: [{ slug: "guides" }, { slug: "news" }, { slug: "updates" }],
    });
    expect(term.json()).toEqual({
      id: news,
      title: "News",
      slug: "news",
      description: "",
      taxonomy: "categories",
    });
    expect(newsPosts.json().total).toBe(2);
    expect(newsPosts.json().items[0].data.categories).toEqual([
      { id: guides, title: "Guides", slug: "guides", taxonomy: "categories" },
      { id: news, title: "News", slug: "news", taxonomy: "categories" },
    ]);
    expect((await deliver("/delivery/posts?taxonomy=tags&term=news")).statusCode).toBe(404);
    expect((await deliver("/delivery/taxonomies/categories/nope")).statusCode).toBe(404);
  });

  it("lets people who look after terms add them, without changing taxonomies", async () => {
    await createTestUser(testDatabase.database, "writer@example.com", [
      ["taxonomies:read", "terms:update"],
    ]);
    const writer = requestsAs(server, await signInAndGetCookies(server, "writer@example.com"));

    expect((await writer("POST", "/taxonomies/tags/terms", { title: "New" })).statusCode).toBe(201);
    expect((await writer("POST", "/taxonomies", { handle: "x", name: "X" })).statusCode).toBe(403);
  });
});
