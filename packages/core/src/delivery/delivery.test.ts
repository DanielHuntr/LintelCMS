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
import { buildEntryUrl } from "./entry-urls.js";

const heroImage: DeliveredAsset = {
  id: "6f1c2a8e-4b3d-4c5e-9f00-0a1b2c3d4e5f",
  url: "http://localhost:4000/media/6f1c2a8e-4b3d-4c5e-9f00-0a1b2c3d4e5f/file",
  alt: "The team at the summer party",
  width: 1600,
  height: 900,
  focalPoint: { x: 0.5, y: 0.3 },
};

const body = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Hello ", marks: [] },
        { type: "text", text: "there", marks: [{ type: "bold" }] },
      ],
    },
  ],
};

describe("buildEntryUrl", () => {
  it("fills in the slug and the publish date", () => {
    const entry = { slug: "hello", publishedAt: new Date("2026-03-07T23:30:00Z") };

    expect(buildEntryUrl("/blog/{slug}", entry)).toBe("/blog/hello");
    expect(buildEntryUrl("/news/{year}/{month}/{day}/{slug}", entry)).toBe(
      "/news/2026/03/07/hello",
    );
    expect(buildEntryUrl(null, entry)).toBeNull();
  });
});

describe("the public delivery API", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let api: SendRequest;
  let lookedUp: string[][];

  beforeEach(async () => {
    lookedUp = [];
    const assetLookup: AssetLookup = {
      findAssetsByIds: async (ids) => {
        lookedUp.push([...ids]);
        return new Map(ids.includes(heroImage.id) ? [[heroImage.id, heroImage]] : []);
      },
    };
    // Entries here use made-up image ids, so accept any id and expand them with the fake lookup.
    server = await startTestServer(testDatabase.activeDatabase, {
      assetLookup,
      assetExists: acceptAnyAsset,
    });
    await ensurePagesCollection(testDatabase.database);
    await ensureBlogPostsCollection(testDatabase.database);
    await createTestUser(testDatabase.database, "ana@example.com", [["*"]]);
    api = requestsAs(server, await signInAndGetCookies(server, "ana@example.com"));
  });

  afterEach(() => server.close());

  function deliver(url: string) {
    // No cookies: anyone on the internet can make these requests.
    return server.inject({ method: "GET", url });
  }

  async function createAndPublish(
    collection: string,
    data: Record<string, unknown>,
  ): Promise<string> {
    const created = await api("POST", `/collections/${collection}/entries`, { data });
    await api("POST", `/entries/${created.json().id}/publish`);
    return created.json().id;
  }

  it("serves a published entry with its URL, expanded image and rendered rich text", async () => {
    const id = await createAndPublish("pages", {
      title: "About us",
      summary: "Who we are",
      hero_image: heroImage.id,
      body,
    });

    const response = await deliver("/delivery/pages/about-us");

    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("public, max-age=60");
    expect(response.json()).toEqual({
      id,
      slug: "about-us",
      url: "/about-us",
      locale: "en-GB",
      translations: [],
      publishedAt: expect.stringMatching(/^\d{4}-/),
      data: {
        title: "About us",
        summary: "Who we are",
        hero_image: heroImage,
        body: { json: body, html: "<p>Hello <strong>there</strong></p>" },
        sections: null,
        design: null,
      },
    });
  });

  it("never serves drafts, and keeps serving the published version after a change is saved", async () => {
    const id = await createAndPublish("posts", { title: "Opening hours", excerpt: "Open 9 to 5" });
    await api("POST", "/collections/posts/entries", { data: { title: "Secret plans" } });

    await api("PATCH", `/entries/${id}`, { data: { excerpt: "Open 8 to 6" } });

    expect((await deliver("/delivery/posts/opening-hours")).json().data.excerpt).toBe(
      "Open 9 to 5",
    );
    expect((await deliver("/delivery/posts/secret-plans")).json()).toMatchObject({
      statusCode: 404,
      code: "NOT_FOUND",
    });
    const list = await deliver("/delivery/posts");
    expect(list.json()).toMatchObject({ total: 1, items: [{ id, url: "/blog/opening-hours" }] });

    await api("POST", `/entries/${id}/publish`);
    expect((await deliver("/delivery/posts/opening-hours")).json().data.excerpt).toBe(
      "Open 8 to 6",
    );

    await api("POST", `/entries/${id}/unpublish`);
    expect((await deliver("/delivery/posts/opening-hours")).statusCode).toBe(404);
    expect((await deliver("/delivery/posts")).json()).toEqual({ items: [], total: 0 });
  });

  it("lists posts newest first a page at a time, looking images up once per page", async () => {
    await createAndPublish("posts", { title: "First", featured_image: heroImage.id });
    await createAndPublish("posts", { title: "Second", featured_image: heroImage.id });
    await createAndPublish("posts", {
      title: "Third",
      featured_image: "11111111-2222-4333-8444-555555555555",
    });

    const response = await deliver("/delivery/posts?perPage=2");

    expect(response.headers["cache-control"]).toBe("public, max-age=60");
    expect(response.json().total).toBe(3);
    const items = response.json().items;
    expect(items.map((item: { data: { title: string } }) => item.data.title)).toEqual([
      "Third",
      "Second",
    ]);
    // An image that is no longer in the media library is delivered as null.
    expect(items[0].data.featured_image).toBeNull();
    expect(items[1].data.featured_image).toEqual(heroImage);
    expect(lookedUp).toEqual([["11111111-2222-4333-8444-555555555555", heroImage.id]]);
  });

  it("answers 404 for a collection that doesn't exist", async () => {
    expect((await deliver("/delivery/nope")).statusCode).toBe(404);
    expect((await deliver("/delivery/nope/hello")).statusCode).toBe(404);
  });
});
