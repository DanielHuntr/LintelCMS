import { type PluginTestServer, startPluginTestServer } from "@lintel/core/plugin-testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FetchFunction } from "./instagram-api.js";
import { createInstagramAddon } from "./index.js";
import { describePicture, refreshTokenIfDue } from "./instagram.service.js";
import { createInstagramClient } from "./instagram-api.js";
import { instagramAccountTable } from "./instagram.table.js";

/**
 * The Instagram add-on on a real Lintel, with Instagram played by a fake `fetch` that
 * answers from `instagram` below and records every address asked for.
 */

const TOKEN = "IGAAexampleLongLivedToken1234";
const PICTURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);

interface FakePost {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  timestamp: string;
}

const instagram = {
  acceptsToken: true,
  reachable: true,
  posts: [] as FakePost[],
  requested: [] as string[],
  refreshedToken: "IGAArefreshedTokenAbcdefgh5678",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const fakeFetch: FetchFunction = async (url) => {
  instagram.requested.push(url);
  if (!instagram.reachable) throw new TypeError("fetch failed");
  const address = new URL(url);
  if (address.hostname === "pictures.example") {
    return new Response(PICTURE, { headers: { "content-type": "image/jpeg" } });
  }
  if (!instagram.acceptsToken) {
    return json({ error: { message: "Invalid OAuth access token", code: 190 } }, 400);
  }
  if (address.pathname === "/me") return json({ user_id: "1784", username: "flourandoven" });
  if (address.pathname === "/refresh_access_token") {
    return json({ access_token: instagram.refreshedToken, expires_in: 5184000 });
  }
  if (address.pathname === "/me/media") {
    const limit = Number(address.searchParams.get("limit"));
    return json({
      data: instagram.posts.slice(0, limit).map((post) => ({
        ...post,
        permalink: `https://www.instagram.com/p/${post.id}/`,
        ...(post.media_type === "VIDEO"
          ? {
              media_url: `https://videos.example/${post.id}.mp4`,
              thumbnail_url: `https://pictures.example/${post.id}-still.jpg`,
            }
          : { media_url: `https://pictures.example/${post.id}.jpg` }),
      })),
    });
  }
  return json({ error: { message: "Unknown path" } }, 404);
};

function makePosts(count: number, from = 0): FakePost[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: `post${from + index}`,
    caption: `Fresh loaves number ${from + index} #bread #sourdough`,
    media_type: "IMAGE" as const,
    timestamp: new Date(Date.UTC(2026, 9, 30 - (from + index))).toISOString(),
  }));
}

describe("the Instagram add-on", () => {
  const addon = createInstagramAddon({ fetch: fakeFetch });
  let lintel: PluginTestServer;
  let asOwner: Awaited<ReturnType<PluginTestServer["signInWith"]>>;

  beforeAll(async () => {
    lintel = await startPluginTestServer({ plugins: [addon] });
    asOwner = await lintel.signInWith(["*"]);
  });

  afterAll(() => lintel.close());

  beforeEach(async () => {
    Object.assign(instagram, { acceptsToken: true, reachable: true, requested: [] });
    instagram.posts = makePosts(4);
    await lintel.setEnabledPlugins(["instagram"]);
    await asOwner({ method: "DELETE", url: "/instagram/account" });
    await asOwner({
      method: "PUT",
      url: "/plugins/instagram/settings",
      payload: { postCount: 12 },
    });
  });

  const connect = () =>
    asOwner({ method: "PUT", url: "/instagram/account", payload: { accessToken: TOKEN } });

  it("checks the token with Instagram, keeps it to itself and copies the posts", async () => {
    const response = await connect();

    expect(response.statusCode).toBe(200);
    const account = response.json();
    expect(account).toMatchObject({
      connected: true,
      username: "flourandoven",
      tokenHint: "…1234",
      lastError: null,
      postCount: 12,
    });
    expect(account.lastSyncedAt).not.toBeNull();
    expect(JSON.stringify(account)).not.toContain(TOKEN);

    const read = await asOwner({ method: "GET", url: "/instagram/account" });
    expect(read.body).not.toContain(TOKEN);
    const posts = (await asOwner({ method: "GET", url: "/instagram/posts" })).json().posts;
    expect(posts).toHaveLength(4);
    expect(posts[0].image).toMatch(
      /^http:\/\/localhost(:\d+)?\/delivery\/add-ons\/instagram\/images\//,
    );
  });

  it("refuses a token Instagram doesn't accept, in plain words", async () => {
    instagram.acceptsToken = false;
    const response = await connect();

    expect(response.statusCode).toBe(422);
    expect(response.json().message).toContain("didn't accept the access token");
    expect((await asOwner({ method: "GET", url: "/instagram/account" })).json().connected).toBe(
      false,
    );
  });

  it("keeps only the newest posts and doesn't download pictures it already has", async () => {
    await connect();
    const newer = makePosts(2, 10).map((post, index) => ({
      ...post,
      timestamp: new Date(Date.UTC(2026, 10, 2 - index)).toISOString(),
    }));
    instagram.posts = [...newer, ...makePosts(3)];
    await asOwner({ method: "PUT", url: "/plugins/instagram/settings", payload: { postCount: 3 } });
    instagram.requested = [];

    await asOwner({ method: "POST", url: "/instagram/sync" });

    const pictures = instagram.requested.filter((url) => url.startsWith("https://pictures."));
    expect(pictures).toEqual([
      "https://pictures.example/post10.jpg",
      "https://pictures.example/post11.jpg",
    ]);
    const posts = (await asOwner({ method: "GET", url: "/instagram/posts" })).json().posts;
    expect(posts.map((post: { permalink: string }) => post.permalink)).toEqual([
      "https://www.instagram.com/p/post10/",
      "https://www.instagram.com/p/post11/",
      "https://www.instagram.com/p/post0/",
    ]);
  });

  it("keeps a video's still picture, not the video", async () => {
    instagram.posts = [
      { id: "clip", media_type: "VIDEO", timestamp: "2026-10-31T09:00:00Z", caption: "" },
    ];
    await connect();

    expect(instagram.requested).toContain("https://pictures.example/clip-still.jpg");
    expect(instagram.requested.some((url) => url.includes("videos.example"))).toBe(false);
  });

  it("gives visitors the posts and pictures from the site's own address", async () => {
    await connect();

    const feed = await lintel.server.inject({
      method: "GET",
      url: "/delivery/add-ons/instagram/posts?limit=2",
    });
    expect(feed.statusCode).toBe(200);
    const body = feed.json();
    expect(body.username).toBe("flourandoven");
    expect(body.posts).toHaveLength(2);
    expect(body.posts[0]).toMatchObject({
      image: expect.stringMatching(/^\/_lintel\/api\/addons\/instagram\/images\/[0-9a-f-]+$/),
      alt: "Fresh loaves number 0",
      permalink: "https://www.instagram.com/p/post0/",
    });

    const picture = await lintel.server.inject({
      method: "GET",
      url: body.posts[0].image.replace("/_lintel/api/addons", "/delivery/add-ons"),
    });
    expect(picture.statusCode).toBe(200);
    expect(picture.headers["content-type"]).toBe("image/jpeg");
    expect(picture.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect(new Uint8Array(picture.rawPayload)).toEqual(PICTURE);

    const missing = await lintel.server.inject({
      method: "GET",
      url: "/delivery/add-ons/instagram/images/not-a-post",
    });
    expect(missing.statusCode).toBe(404);
  });

  it("uses the description an editor wrote", async () => {
    await connect();
    const [first] = (await asOwner({ method: "GET", url: "/instagram/posts" })).json().posts;

    const saved = await asOwner({
      method: "PATCH",
      url: `/instagram/posts/${first.id}`,
      payload: { altText: "Three sourdough loaves cooling on a rack" },
    });
    expect(saved.statusCode).toBe(204);

    const feed = await lintel.server.inject({
      method: "GET",
      url: "/delivery/add-ons/instagram/posts",
    });
    expect(feed.json().posts[0].alt).toBe("Three sourdough loaves cooling on a rack");
  });

  it("is not there while switched off", async () => {
    await connect();
    await lintel.setEnabledPlugins([]);

    const feed = await lintel.server.inject({
      method: "GET",
      url: "/delivery/add-ons/instagram/posts",
    });
    expect(feed.statusCode).toBe(404);
    expect(feed.json().code).toBe("PLUGIN_NOT_ENABLED");
    expect(await lintel.renderLiquid("{% instagram_feed %}")).toBe("");
  });

  it("draws the grid in Liquid templates from the copied posts", async () => {
    await connect();

    const html = await lintel.renderLiquid("{% instagram_feed limit: 2, columns: 2 %}");
    expect(html).toContain("--instagram-columns:2");
    expect(html.match(/<img /g)).toHaveLength(2);
    expect(html).toContain('src="/_lintel/api/addons/instagram/images/');
    expect(html).toContain('alt="Fresh loaves number 0"');
    expect(html).toContain('href="https://www.instagram.com/flourandoven/"');
    expect(html).not.toContain("pictures.example");

    const plain = await lintel.renderLiquid("{% instagram_feed profile_link: false %}");
    expect(plain).not.toContain("instagram-feed__profile");
  });

  it("keeps the posts it has and says why when Instagram can't be reached", async () => {
    await connect();
    instagram.reachable = false;

    const account = (await asOwner({ method: "POST", url: "/instagram/sync" })).json();
    expect(account.lastError).toContain("couldn't reach Instagram");
    expect((await asOwner({ method: "GET", url: "/instagram/posts" })).json().posts).toHaveLength(
      4,
    );

    instagram.reachable = true;
    await lintel.runJob("instagram", "sync");
    const fixed = (await asOwner({ method: "GET", url: "/instagram/account" })).json();
    expect(fixed.lastError).toBeNull();
  });

  it("renews the token once it is a day old", async () => {
    await connect();
    const client = createInstagramClient(fakeFetch);

    expect(await refreshTokenIfDue(lintel.database, client)).toBe(false);
    const tomorrow = new Date(Date.now() + 25 * 60 * 60 * 1000);
    expect(await refreshTokenIfDue(lintel.database, client, tomorrow)).toBe(true);

    const [account] = await lintel.database.select().from(instagramAccountTable);
    expect(account?.accessToken).toBe(instagram.refreshedToken);
    expect(account?.tokenRefreshedAt.toISOString()).toBe(tomorrow.toISOString());
  });

  it("forgets the token and the posts when disconnected", async () => {
    await connect();

    expect((await asOwner({ method: "DELETE", url: "/instagram/account" })).statusCode).toBe(204);
    expect((await asOwner({ method: "GET", url: "/instagram/posts" })).json().posts).toEqual([]);
    expect(await lintel.database.select().from(instagramAccountTable)).toEqual([]);
  });

  it("lets only people who can change settings connect an account", async () => {
    const asEditor = await lintel.signInWith(["settings:read"]);
    const response = await asEditor({
      method: "PUT",
      url: "/instagram/account",
      payload: { accessToken: TOKEN },
    });
    expect(response.statusCode).toBe(403);
  });
});

describe("describing a post's picture", () => {
  it("prefers the editor's words, then the caption without hashtags", () => {
    expect(describePicture({ altText: "A cake", caption: "Hello" }, "shop")).toBe("A cake");
    expect(describePicture({ altText: "", caption: "New bakes today #bread\nMore" }, "shop")).toBe(
      "New bakes today",
    );
    expect(describePicture({ altText: "", caption: "#bread #cake" }, "shop")).toBe(
      "A post by @shop on Instagram",
    );
  });
});
