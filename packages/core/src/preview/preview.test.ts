import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ensureBlogPostsCollection,
  ensurePagesCollection,
} from "../collections/default-collections.js";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import {
  checkPreviewToken,
  generatePreviewSecret,
  PREVIEW_TOKEN_LIFETIME_MS,
  signPreviewToken,
} from "./preview-tokens.js";
import { buildPreviewUrl } from "./preview-urls.js";

const ENTRY_ID = "6f1c2a8e-4b3d-4c5e-9f00-0a1b2c3d4e5f";

describe("preview tokens", () => {
  const secret = generatePreviewSecret();
  const now = new Date("2026-11-01T09:00:00Z");
  const token = signPreviewToken({ entryId: ENTRY_ID, expiresAt: now.getTime() + 60_000 }, secret);

  it("are accepted until they expire", () => {
    expect(checkPreviewToken(token, secret, now)).toEqual({
      status: "valid",
      payload: { entryId: ENTRY_ID, expiresAt: now.getTime() + 60_000 },
    });
    expect(checkPreviewToken(token, secret, new Date(now.getTime() + 60_000))).toEqual({
      status: "expired",
    });
  });

  it("are refused when changed, made with another secret, or not tokens at all", () => {
    const [payload, signature] = token.split(".");
    const otherEntry = Buffer.from(
      JSON.stringify({ entryId: "11111111-2222-4333-8444-555555555555", expiresAt: 9e15 }),
    ).toString("base64url");

    expect(checkPreviewToken(`${otherEntry}.${signature}`, secret, now).status).toBe("invalid");
    expect(checkPreviewToken(token, generatePreviewSecret(), now).status).toBe("invalid");
    expect(checkPreviewToken(`${payload}`, secret, now).status).toBe("invalid");
    expect(checkPreviewToken("hello.world.again", secret, now).status).toBe("invalid");
  });
});

describe("buildPreviewUrl", () => {
  const values = {
    url: "/about/team",
    slug: "team",
    token: "abc.def",
    collection: "pages",
    id: ENTRY_ID,
  };

  it("fills in the placeholders", () => {
    expect(
      buildPreviewUrl("https://example.com/api/preview?path={url}&token={token}", values),
    ).toBe("https://example.com/api/preview?path=/about/team&token=abc.def");
    expect(buildPreviewUrl("http://localhost:3000/{collection}/{slug}?t={token}", values)).toBe(
      "http://localhost:3000/pages/team?t=abc.def",
    );
  });

  it("adds the token when the pattern doesn't place it, and gives null without a pattern", () => {
    expect(buildPreviewUrl("https://example.com{url}", values)).toBe(
      "https://example.com/about/team?preview=abc.def",
    );
    expect(buildPreviewUrl("https://example.com/preview?id={id}", values)).toBe(
      `https://example.com/preview?id=${ENTRY_ID}&preview=abc.def`,
    );
    expect(buildPreviewUrl(null, values)).toBeNull();
  });
});

describe("live preview through the API", () => {
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

  function publicRequest(url: string, headers: Record<string, string> = {}) {
    return server.inject({ method: "GET", url, headers });
  }

  async function createPage(title: string, summary: string): Promise<string> {
    const created = await api("POST", "/collections/pages/entries", { data: { title, summary } });
    return created.json().id;
  }

  it("gives a token, and the website's preview address once the collection has one", async () => {
    const id = await createPage("About us", "Draft words");

    const withoutSite = await api("POST", `/entries/${id}/preview`);
    expect(withoutSite.statusCode).toBe(200);
    expect(withoutSite.json()).toEqual({
      token: expect.stringMatching(/^[\w-]+\.[\w-]+$/),
      expiresAt: expect.stringMatching(/^\d{4}-/),
      previewUrl: null,
    });
    const lifetime = Date.parse(withoutSite.json().expiresAt) - Date.now();
    expect(lifetime).toBeGreaterThan(PREVIEW_TOKEN_LIFETIME_MS - 60_000);

    const updated = await api("PUT", "/collections/pages", {
      previewUrlPattern: "https://example.com/api/preview?path={url}&token={token}",
    });
    expect(updated.json().previewUrlPattern).toBe(
      "https://example.com/api/preview?path={url}&token={token}",
    );
    const withSite = (await api("POST", `/entries/${id}/preview`)).json();
    expect(withSite.previewUrl).toBe(
      `https://example.com/api/preview?path=/about-us&token=${withSite.token}`,
    );
  });

  it("refuses preview addresses that aren't web addresses", async () => {
    const response = await api("PUT", "/collections/pages", {
      previewUrlPattern: "javascript:alert(1)",
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain("should start with https://");

    const unknownPlaceholder = await api("PUT", "/collections/pages", {
      previewUrlPattern: "https://example.com/{title}",
    });
    expect(unknownPlaceholder.statusCode).toBe(400);
  });

  it("serves the draft to anyone with the token, never cached, and nothing without it", async () => {
    const id = await createPage("About us", "Draft words");
    const { token } = (await api("POST", `/entries/${id}/preview`)).json();

    const preview = await publicRequest(`/preview?token=${token}`);
    expect(preview.statusCode).toBe(200);
    expect(preview.headers["cache-control"]).toBe("private, no-store");
    expect(preview.json()).toMatchObject({
      collection: "pages",
      entry: { id, slug: "about-us", url: "/about-us", publishedAt: null },
    });
    expect(preview.json().entry.data.summary).toBe("Draft words");

    expect((await publicRequest("/delivery/pages/about-us")).statusCode).toBe(404);
    const bySlug = await publicRequest(`/delivery/pages/about-us?preview=${token}`);
    expect(bySlug.json().data.summary).toBe("Draft words");
    expect(bySlug.headers["cache-control"]).toBe("private, no-store");
    const byHeader = await publicRequest("/delivery/pages/about-us", { "lintel-preview": token });
    expect(byHeader.json().data.summary).toBe("Draft words");
  });

  it("shows unpublished changes to a live page only with the token", async () => {
    const id = await createPage("Opening hours", "Open 9 to 5");
    await api("POST", `/entries/${id}/publish`);
    await api("PATCH", `/entries/${id}`, { data: { summary: "Open 8 to 6" } });
    const { token } = (await api("POST", `/entries/${id}/preview`)).json();

    const published = await publicRequest("/delivery/pages/opening-hours");
    const previewed = await publicRequest(`/delivery/pages/opening-hours?preview=${token}`);

    expect(published.json().data.summary).toBe("Open 9 to 5");
    expect(previewed.json().data.summary).toBe("Open 8 to 6");
  });

  it("only previews the entry the token was made for", async () => {
    const draftId = await createPage("Secret plans", "Not yet");
    const liveId = await createPage("Contact", "Call us");
    await api("POST", `/entries/${liveId}/publish`);
    const { token } = (await api("POST", `/entries/${draftId}/preview`)).json();

    expect((await publicRequest(`/delivery/pages/contact?preview=${token}`)).json().id).toBe(
      liveId,
    );
    const otherDraft = await createPage("Other draft", "Hidden");
    expect(otherDraft).toBeTruthy();
    expect((await publicRequest(`/delivery/pages/other-draft?preview=${token}`)).statusCode).toBe(
      404,
    );
  });

  it("answers 401 for a token that is wrong, and for one whose entry was deleted", async () => {
    const wrong = await publicRequest("/preview?token=not.a-token");
    expect(wrong.statusCode).toBe(401);
    expect(wrong.json().code).toBe("PREVIEW_TOKEN_INVALID");
    expect((await publicRequest("/delivery/pages/x?preview=not.a-token")).statusCode).toBe(401);
    expect((await publicRequest("/preview")).statusCode).toBe(400);

    const id = await createPage("Short lived", "Soon gone");
    const { token } = (await api("POST", `/entries/${id}/preview`)).json();
    await api("DELETE", `/entries/${id}`);
    expect((await publicRequest(`/preview?token=${token}`)).statusCode).toBe(401);
  });

  it("needs entries:read to make a token", async () => {
    await createTestUser(testDatabase.database, "media@example.com", [["media:read"]]);
    const mediaOnly = requestsAs(server, await signInAndGetCookies(server, "media@example.com"));
    const id = await createPage("About us", "Draft words");

    expect((await mediaOnly("POST", `/entries/${id}/preview`)).statusCode).toBe(403);
    expect(
      (await server.inject({ method: "POST", url: `/entries/${id}/preview` })).statusCode,
    ).toBe(401);
  });
});
