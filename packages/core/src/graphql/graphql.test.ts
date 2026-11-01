import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ensureBlogPostsCollection,
  ensurePagesCollection,
} from "../collections/default-collections.js";
import {
  acceptAnyAsset,
  type AssetLookup,
  type DeliveredAsset,
} from "../fieldtypes/image-assets.js";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { buildSchema, parse, validate } from "graphql";
import { maxCostRule, maxDepthRule } from "./graphql-limits.js";
import { camelCaseName, collectionQueryNames } from "./graphql-names.js";
import { transformedAssetUrl } from "./graphql-shared-types.js";

const heroImage: DeliveredAsset = {
  id: "6f1c2a8e-4b3d-4c5e-9f00-0a1b2c3d4e5f",
  url: "http://localhost:4000/media/6f1c2a8e-4b3d-4c5e-9f00-0a1b2c3d4e5f/file?v=abc",
  alt: "The team",
  width: 1600,
  height: 900,
  focalPoint: { x: 0.5, y: 0.3 },
};

describe("the GraphQL delivery API", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let api: SendRequest;

  beforeEach(async () => {
    const assetLookup: AssetLookup = {
      findAssetsByIds: async (ids) =>
        new Map(ids.includes(heroImage.id) ? [[heroImage.id, heroImage]] : []),
    };
    server = await startTestServer(testDatabase.activeDatabase, {
      assetLookup,
      assetExists: acceptAnyAsset,
    });
    await ensurePagesCollection(testDatabase.database);
    await ensureBlogPostsCollection(testDatabase.database);
    await createTestUser(testDatabase.database, "admin@example.com", [["*"]]);
    api = requestsAs(server, await signInAndGetCookies(server, "admin@example.com"));
  });

  afterEach(() => server.close());

  function query(text: string, headers: Record<string, string> = {}) {
    return server.inject({
      method: "POST",
      url: "/graphql",
      headers: { "content-type": "application/json", ...headers },
      payload: { query: text },
    });
  }

  async function createPage(data: Record<string, unknown>, publish: boolean) {
    const created = await api("POST", "/collections/pages/entries", { data });
    if (publish) {
      await api("POST", `/entries/${created.json().id}/publish`);
    }
    return created.json().id as string;
  }

  it("has typed queries for every collection, with fields from its blueprint", async () => {
    await createPage({ title: "About us", hero_image: heroImage.id, summary: "Who we are" }, true);

    const response = await query(`{
      collections { handle name }
      pages { total items { slug url status data { title summary hero_image { alt width url(width: 400, format: webp) } } } }
      pagesEntry(slug: "about-us") { data { title } }
    }`);

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    const { data, errors } = response.json();
    expect(errors).toBeUndefined();
    expect(data.collections.map((collection: { handle: string }) => collection.handle)).toEqual([
      "pages",
      "posts",
    ]);
    expect(data.pages).toEqual({
      total: 1,
      items: [
        {
          slug: "about-us",
          url: "/about-us",
          status: "published",
          data: {
            title: "About us",
            summary: "Who we are",
            hero_image: {
              alt: "The team",
              width: 1600,
              url: `${heroImage.url}&w=400&format=webp`,
            },
          },
        },
      ],
    });
    expect(data.pagesEntry.data.title).toBe("About us");
  });

  it("serves only published content, and drafts only to previews that may see them", async () => {
    await createPage({ title: "Secret plans" }, false);

    const published = await query(`{ pages { total } pagesEntry(slug: "secret-plans") { slug } }`);
    expect(published.json().data).toEqual({ pages: { total: 0 }, pagesEntry: null });

    const anonymousPreview = await query(
      `{ pagesEntry(slug: "secret-plans", preview: true) { slug } }`,
    );
    expect(anonymousPreview.json().errors[0]).toMatchObject({
      message: expect.stringContaining("Previewing drafts needs a preview link"),
      extensions: { code: "PREVIEW_NOT_ALLOWED" },
    });

    const readToken = (await api("POST", "/api-tokens", { name: "Site", access: "read" })).json();
    const writeToken = (
      await api("POST", "/api-tokens", { name: "Preview", access: "readWrite" })
    ).json();
    const previewQuery = `{ pagesEntry(slug: "secret-plans", preview: true) { status data { title } } }`;

    const withReadToken = await query(previewQuery, {
      authorization: `Bearer ${readToken.secret}`,
    });
    expect(withReadToken.json().errors[0].extensions.code).toBe("PREVIEW_NOT_ALLOWED");

    const withWriteToken = await query(previewQuery, {
      authorization: `Bearer ${writeToken.secret}`,
    });
    expect(withWriteToken.json().data.pagesEntry).toEqual({
      status: "draft",
      data: { title: "Secret plans" },
    });
  });

  it("lets a live-preview link's token read that one draft, and no other", async () => {
    const secretId = await createPage({ title: "Secret plans" }, false);
    await createPage({ title: "Other plans" }, false);
    const { token } = (await api("POST", `/entries/${secretId}/preview`)).json();
    const headers = { "lintel-preview": token };

    const own = await query(
      `{ pagesEntry(slug: "secret-plans", preview: true) { status data { title } } }`,
      headers,
    );
    const other = await query(
      `{ pagesEntry(slug: "other-plans", preview: true) { slug } }`,
      headers,
    );
    const list = await query(`{ pages(preview: true) { total } }`, headers);

    expect(own.json().data.pagesEntry).toEqual({
      status: "draft",
      data: { title: "Secret plans" },
    });
    expect(other.json().errors[0].extensions.code).toBe("PREVIEW_NOT_ALLOWED");
    expect(list.json().errors[0].extensions.code).toBe("PREVIEW_NOT_ALLOWED");
  });

  it("refuses queries that cost too much, but lets ordinary ones and introspection through", async () => {
    const ordinary = await query(
      `{ pages(perPage: 100) { items { data { title summary hero_image { url alt focalPoint { x y } } } } } }`,
    );
    expect(ordinary.json().errors).toBeUndefined();

    const introspection = await query(
      `{ __schema { types { name fields { name type { name ofType { name ofType { name ofType { name } } } } } } } }`,
    );
    expect(introspection.json().errors).toBeUndefined();

    const aliases = Array.from(
      { length: 40 },
      (_, index) => `a${index}: pages(perPage: 100) { items { data { title summary } } }`,
    ).join("\n");
    const tooCostly = await query(`{ ${aliases} }`);
    expect(tooCostly.json().errors[0]).toMatchObject({
      message: expect.stringContaining("the most allowed is 5000"),
      extensions: { code: "QUERY_TOO_COSTLY" },
    });
  });

  it("follows changes to content types without a restart", async () => {
    const blueprint = (await api("GET", "/blueprints/page")).json();
    // Ask once first, so the test also shows the stored schema being replaced.
    await query(`{ pages { total } }`);
    await api("PUT", "/blueprints/page", {
      name: blueprint.name,
      fields: [
        ...blueprint.fields,
        { handle: "show_in_menu", label: "Show in menu", type: "toggle" },
      ],
    });
    await createPage({ title: "Home", show_in_menu: true }, true);

    const response = await query(`{ pages { items { data { show_in_menu } } } }`);
    expect(response.json().data.pages.items).toEqual([{ data: { show_in_menu: true } }]);
  });

  it("lists the media library only for requests with a token", async () => {
    const anonymous = await query(`{ assets { total } }`);
    expect(anonymous.json().errors[0].extensions.code).toBe("API_TOKEN_REQUIRED");

    const token = (await api("POST", "/api-tokens", { name: "Site", access: "read" })).json();
    const withToken = await query(`{ assets { total items { id } } }`, {
      authorization: `Bearer ${token.secret}`,
    });
    expect(withToken.json().data.assets).toEqual({ total: 0, items: [] });

    const single = await query(`{ asset(id: "${heroImage.id}") { alt } }`);
    expect(single.json().data.asset).toEqual({ alt: "The team" });
  });

  it("asks for a token when the site needs one", async () => {
    await api("PUT", "/delivery-access", { requireToken: true });

    const response = await query(`{ collections { handle } }`);
    expect(response.statusCode).toBe(401);
    expect(response.json().code).toBe("API_TOKEN_REQUIRED");
  });

  it("checks page sizes", async () => {
    const response = await query(`{ pages(perPage: 500) { total } }`);
    expect(response.json().errors[0].message).toContain("perPage from 1 to 100");
  });
});

describe("GraphQL names", () => {
  it("are made from handles", () => {
    expect(camelCaseName("blog_posts")).toBe("blogPosts");
    expect(collectionQueryNames("blog_posts")).toEqual({
      list: "blogPosts",
      single: "blogPostsEntry",
    });
    expect(collectionQueryNames("assets")).toEqual({
      list: "assetsEntries",
      single: "assetsEntry",
    });
  });

  it("add image sizes to an asset's address", () => {
    expect(
      transformedAssetUrl("http://api.test/media/1/file?v=abc", { width: 200, fit: "cover" }),
    ).toBe("http://api.test/media/1/file?v=abc&w=200&fit=cover");
  });
});

describe("query limits", () => {
  // Entries that link to entries will make loops like this possible.
  const schema = buildSchema(`
    type Page { title: String, parent: Page, children(perPage: Int): PageList }
    type PageList { items: [Page!]! }
    type Query { page: Page, pages(perPage: Int): PageList }
  `);

  function problems(text: string) {
    return validate(schema, parse(text), [maxDepthRule(4), maxCostRule(500)]).map(
      (error) => error.message,
    );
  }

  it("counts nesting, through fragments too", () => {
    expect(problems(`{ page { parent { parent { title } } } }`)).toEqual([]);
    expect(problems(`{ page { parent { parent { parent { title } } } } }`)[0]).toContain(
      "nests 5 levels deep; the most allowed is 4",
    );
    expect(
      problems(`{ page { ...Up } } fragment Up on Page { parent { parent { parent { title } } } }`),
    ).toHaveLength(1);
  });

  it("counts every item a page of results may hold", () => {
    expect(problems(`{ pages(perPage: 10) { items { title } } }`)).toEqual([]);
    expect(problems(`{ pages(perPage: 100) { items { title parent { title } } } }`)[0]).toContain(
      "could return about",
    );
    // A page size from a variable isn't known yet, so the largest is assumed.
    expect(
      problems(`query ($size: Int) { pages(perPage: $size) { items { title parent { title } } } }`),
    ).toHaveLength(1);
  });
});
