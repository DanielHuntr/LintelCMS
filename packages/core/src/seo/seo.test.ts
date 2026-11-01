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

const socialImage: DeliveredAsset = {
  id: "6f1c2a8e-4b3d-4c5e-9f00-0a1b2c3d4e5f",
  url: "http://localhost:4000/media/6f1c2a8e-4b3d-4c5e-9f00-0a1b2c3d4e5f/file?v=abc",
  alt: "Our shop front",
  width: 1200,
  height: 630,
  focalPoint: { x: 0.5, y: 0.5 },
};

describe("the SEO plugin", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let api: SendRequest;

  beforeEach(async () => {
    const assetLookup: AssetLookup = {
      findAssetsByIds: async (ids) =>
        new Map(ids.includes(socialImage.id) ? [[socialImage.id, socialImage]] : []),
    };
    server = await startTestServer(testDatabase.activeDatabase, {
      assetLookup,
      assetExists: acceptAnyAsset,
    });
    await ensurePagesCollection(testDatabase.database);
    await ensureBlogPostsCollection(testDatabase.database);
    await createTestUser(testDatabase.database, "admin@example.com", [["*"]]);
    api = requestsAs(server, await signInAndGetCookies(server, "admin@example.com"));
    await api("PUT", "/plugins", { enabled: ["seo"] });
  });

  afterEach(() => server.close());

  async function publishPage(title: string, collection = "pages") {
    const created = await api("POST", `/collections/${collection}/entries`, { data: { title } });
    await api("POST", `/entries/${created.json().id}/publish`);
    return created.json().id as string;
  }

  function get(url: string) {
    return server.inject({ method: "GET", url });
  }

  it("is switched off until the plugin is on", async () => {
    await api("PUT", "/plugins", { enabled: [] });

    const responses = await Promise.all([
      api("GET", "/seo/defaults"),
      api("GET", "/seo/redirects"),
      get("/sitemap.xml"),
      get("/robots.txt"),
    ]);
    for (const response of responses) {
      expect(response.statusCode).toBe(404);
      expect(response.json().code).toBe("PLUGIN_NOT_ENABLED");
    }
  });

  it("builds each page's title, description and image from its own settings and the site's", async () => {
    await api("PUT", "/seo/defaults", {
      siteName: "Corner Bakery",
      siteUrl: "https://www.cornerbakery.example/",
      defaultDescription: "Fresh bread every morning.",
      defaultSocialImageId: socialImage.id,
    });
    const aboutId = await publishPage("About us");
    await publishPage("Opening hours");

    const saved = await api("PUT", `/seo/entries/${aboutId}`, {
      title: "Our story",
      description: "Three generations of baking on the same corner.",
      noindex: false,
    });
    expect(saved.json()).toEqual({
      title: "Our story",
      description: "Three generations of baking on the same corner.",
      socialImageId: null,
      noindex: false,
    });

    expect((await get("/delivery/pages/about-us/seo")).json()).toEqual({
      title: "Our story | Corner Bakery",
      description: "Three generations of baking on the same corner.",
      canonicalUrl: "https://www.cornerbakery.example/about-us",
      image: { url: socialImage.url, alt: "Our shop front", width: 1200, height: 630 },
      noindex: false,
    });
    expect((await get("/delivery/pages/opening-hours/seo")).json()).toMatchObject({
      title: "Opening hours | Corner Bakery",
      description: "Fresh bread every morning.",
    });
  });

  it("checks the site defaults", async () => {
    const response = await api("PUT", "/seo/defaults", {
      titleTemplate: "Corner Bakery",
      siteUrl: "cornerbakery",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain("needs {title} in it");
    expect(response.json().message).toContain("should start with https://");
  });

  it("lists published pages in the sitemap, leaving out hidden ones, and writes robots.txt", async () => {
    expect((await get("/sitemap.xml")).json().code).toBe("SITE_ADDRESS_MISSING");

    await api("PUT", "/seo/defaults", { siteUrl: "https://www.example.com" });
    const hiddenId = await publishPage("Thank you");
    await publishPage("Contact");
    await publishPage("Hello world", "posts");
    await api("POST", "/collections/pages/entries", { data: { title: "Draft page" } });
    await api("PUT", `/seo/entries/${hiddenId}`, { noindex: true });

    const sitemap = await get("/sitemap.xml");
    expect(sitemap.headers["content-type"]).toContain("application/xml");
    expect(sitemap.body).toContain("<loc>https://www.example.com/contact</loc>");
    expect(sitemap.body).toContain("<loc>https://www.example.com/blog/hello-world</loc>");
    expect(sitemap.body).not.toContain("thank-you");
    expect(sitemap.body).not.toContain("draft-page");

    expect((await get("/robots.txt")).body).toBe(
      "User-agent: *\nAllow: /\n\nSitemap: https://www.example.com/sitemap.xml\n",
    );
    await api("PUT", "/seo/defaults", { discourageSearchEngines: true });
    expect((await get("/robots.txt")).body).toBe("User-agent: *\nDisallow: /\n");
    expect((await get("/delivery/pages/contact/seo")).json().noindex).toBe(true);
  });

  it("manages redirects, tidying addresses and refusing duplicates and loops", async () => {
    const created = await api("POST", "/seo/redirects", {
      fromPath: "https://old.example.com/About-Us/?ref=mail",
      toPath: "/about",
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      fromPath: "/About-Us",
      toPath: "/about",
      statusCode: 301,
      status: "active",
      source: "manual",
    });

    const duplicate = await api("POST", "/seo/redirects", { fromPath: "/About-Us/", toPath: "/x" });
    expect(duplicate.statusCode).toBe(409);
    const loop = await api("POST", "/seo/redirects", { fromPath: "/a", toPath: "/a/" });
    expect(loop.json().fields.toPath).toBe("This is the same as the old address");

    const changed = await api("PATCH", `/seo/redirects/${created.json().id}`, { statusCode: 302 });
    expect(changed.json().statusCode).toBe(302);
    expect((await get("/delivery/seo-redirects")).json()).toEqual({
      redirects: [{ from: "/About-Us", to: "/about", statusCode: 302 }],
    });

    expect((await api("DELETE", `/seo/redirects/${created.json().id}`)).statusCode).toBe(204);
    expect((await get("/delivery/seo-redirects")).json().redirects).toEqual([]);
  });

  it("imports redirects from a CSV, reporting lines it couldn't use", async () => {
    await api("POST", "/seo/redirects", { fromPath: "/sale", toPath: "/old-offers" });

    const response = await api("POST", "/seo/redirects/import", {
      csv: [
        "Old address,New address,Type",
        "/team,/about/team,301",
        '"/sale","https://shop.example.com/offers",302',
        "not a path at all,,",
        "/same,/same",
        "",
        "/menu\t/food",
      ].join("\n"),
    });

    expect(response.json()).toEqual({
      added: 2,
      updated: 1,
      problems: [
        { line: 4, message: expect.stringContaining("new address") },
        { line: 5, message: "The old and new addresses are the same" },
      ],
    });
    const list = (await api("GET", "/seo/redirects")).json().redirects;
    expect(
      list.map((redirect: { fromPath: string; toPath: string }) => [
        redirect.fromPath,
        redirect.toPath,
      ]),
    ).toEqual([
      ["/menu", "/food"],
      ["/sale", "https://shop.example.com/offers"],
      ["/team", "/about/team"],
    ]);
  });

  it("suggests a redirect when a live page's address changes, and accepting it shortens chains", async () => {
    const entryId = await publishPage("About us");
    await api("POST", "/seo/redirects", { fromPath: "/our-story", toPath: "/about-us" });

    await api("PATCH", `/entries/${entryId}`, { slug: "about" });

    const suggested = (await api("GET", "/seo/redirects?status=suggested")).json().redirects;
    expect(suggested).toEqual([
      expect.objectContaining({
        fromPath: "/about-us",
        toPath: "/about",
        status: "suggested",
        source: "automatic",
        entryId,
      }),
    ]);
    // Suggestions do nothing until accepted, but the older redirect already skips the hop.
    expect((await get("/delivery/seo-redirects")).json().redirects).toEqual([
      { from: "/our-story", to: "/about", statusCode: 301 },
    ]);

    const accepted = await api("PATCH", `/seo/redirects/${suggested[0].id}`, { status: "active" });
    expect(accepted.json().status).toBe("active");
    expect((await get("/delivery/seo-redirects")).json().redirects).toEqual([
      { from: "/about-us", to: "/about", statusCode: 301 },
      { from: "/our-story", to: "/about", statusCode: 301 },
    ]);

    // Moving back removes the redirect away from the page's address again.
    await api("PATCH", `/entries/${entryId}`, { slug: "about-us" });
    const all = (await api("GET", "/seo/redirects")).json().redirects;
    expect(
      all.find((redirect: { fromPath: string }) => redirect.fromPath === "/about-us"),
    ).toBeUndefined();
  });

  it("doesn't suggest redirects for drafts, or while the plugin is off", async () => {
    const draft = await api("POST", "/collections/pages/entries", { data: { title: "Draft" } });
    await api("PATCH", `/entries/${draft.json().id}`, { slug: "renamed-draft" });

    await api("PUT", "/plugins", { enabled: [] });
    const liveId = await publishPage("Live");
    await api("PATCH", `/entries/${liveId}`, { slug: "still-live" });

    await api("PUT", "/plugins", { enabled: ["seo"] });
    expect((await api("GET", "/seo/redirects")).json().redirects).toEqual([]);
  });

  it("refuses a social image that isn't in the media library", async () => {
    const strictServer = await startTestServer(testDatabase.activeDatabase, {
      assetExists: async () => false,
    });
    const strict = requestsAs(
      strictServer,
      await signInAndGetCookies(strictServer, "admin@example.com"),
    );
    const entryId = await publishPage("Gallery");

    const response = await strict("PUT", `/seo/entries/${entryId}`, {
      socialImageId: socialImage.id,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().fields.socialImageId).toContain("isn't in the media library");
    await strictServer.close();
  });
});
