import { describe, expect, it } from "vitest";
import {
  ensureBlogPostsCollection,
  ensurePagesCollection,
} from "../collections/default-collections.js";
import { useTestDatabase } from "../testing/test-database.js";
import { makeTestPng, useMediaTestServer } from "../testing/test-media.js";
import { requestsAs } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { prefixTsQuery, searchWords } from "./search-terms.js";

describe("search terms", () => {
  it("keeps letters and numbers only, once each, as prefixes", () => {
    expect(searchWords("  About US: 'team' & 2026!! about ")).toEqual([
      "about",
      "us",
      "team",
      "2026",
    ]);
    expect(searchWords("Café crème")).toEqual(["café", "crème"]);
    expect(searchWords("!!! %%")).toEqual([]);
    expect(prefixTsQuery(["about", "us"])).toBe("about:* & us:*");
  });
});

describe("GET /search", () => {
  const testDatabase = useTestDatabase();
  const media = useMediaTestServer(testDatabase);

  const paragraph = (text: string) => ({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  });

  async function setUp() {
    await ensurePagesCollection(testDatabase.database);
    await ensureBlogPostsCollection(testDatabase.database);
    const api = requestsAs(media.server, media.adminCookies);
    await api("POST", "/collections/pages/entries", {
      data: { title: "About us", summary: "Who we are and how we work" },
    });
    await api("POST", "/collections/pages/entries", {
      data: {
        title: "Home",
        sections: [
          {
            id: "a3c1f6d2-9b0e-4c7a-8f21-6d5e4b3a2c10",
            type: "faq",
            data: { question: "Do you deliver?", answer: paragraph("Yes, within Bristol") },
          },
        ],
      },
    });
    await api("POST", "/collections/posts/entries", { data: { title: "Support hours" } });
    const upload = await media.upload("shop-front.png", await makeTestPng(20, 10, 1));
    await media.server.inject({
      method: "PATCH",
      url: `/media/${upload.json().id}`,
      cookies: media.adminCookies,
      payload: { alt: "Our bakery in Bristol" },
    });
    return api;
  }

  it("finds entries by the start of words in their title, slug or any of their text", async () => {
    const api = await setUp();

    const byTitle = (await api("GET", "/search?q=abo")).json();
    expect(byTitle.entries.map((entry: { title: string }) => entry.title)).toEqual(["About us"]);
    expect(byTitle.entries[0]).toMatchObject({
      slug: "about-us",
      status: "draft",
      collection: { handle: "pages", name: "Pages" },
    });

    const insideBlocks = (await api("GET", "/search?q=bristol")).json();
    expect(insideBlocks.entries.map((entry: { title: string }) => entry.title)).toEqual(["Home"]);
    expect(insideBlocks.assets.map((asset: { filename: string }) => asset.filename)).toEqual([
      "shop-front.png",
    ]);
    expect(insideBlocks.assets[0].thumbnailUrl).toContain("/file?");

    // The middle of a word in a title counts too.
    const middle = (await api("GET", "/search?q=port")).json();
    expect(middle.entries.map((entry: { title: string }) => entry.title)).toEqual([
      "Support hours",
    ]);
  });

  it("ranks title matches first and needs every word", async () => {
    const api = await setUp();
    await api("POST", "/collections/posts/entries", {
      data: { title: "News", excerpt: "We moved: read about us" },
    });

    const results = (await api("GET", "/search?q=about")).json();
    expect(results.entries.map((entry: { title: string }) => entry.title)).toEqual([
      "About us",
      "News",
    ]);
    expect((await api("GET", "/search?q=about+deliver")).json().entries).toEqual([]);
  });

  it("only searches what the person may see", async () => {
    await setUp();
    await createTestUser(testDatabase.database, "writer@example.com", [["entries:read"]]);
    await createTestUser(testDatabase.database, "photos@example.com", [["media:read"]]);
    const writer = requestsAs(
      media.server,
      await signInAndGetCookies(media.server, "writer@example.com"),
    );
    const photos = requestsAs(
      media.server,
      await signInAndGetCookies(media.server, "photos@example.com"),
    );

    const forWriter = (await writer("GET", "/search?q=bristol")).json();
    expect(forWriter.assets).toBeNull();
    expect(forWriter.entries).toHaveLength(1);

    const forPhotos = (await photos("GET", "/search?q=bristol")).json();
    expect(forPhotos.entries).toBeNull();
    expect(forPhotos.assets).toHaveLength(1);

    expect((await media.server.inject({ method: "GET", url: "/search?q=x" })).statusCode).toBe(401);
  });

  it("finds nothing for a search without letters or numbers", async () => {
    const api = await setUp();
    expect((await api("GET", "/search?q=%25%25")).json()).toEqual({
      query: "%%",
      entries: [],
      assets: [],
    });
  });
});
