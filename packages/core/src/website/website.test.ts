import { createEmptyPage, createNode, standardCatalogue } from "@lintel/builder-model";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ensureBlogPostsCollection,
  pagesWithSimpleSectionsCollection,
} from "../collections/default-collections.js";
import { ensureCollection } from "../collections/collections.service.js";
import {
  acceptAnyAsset,
  type AssetLookup,
  type DeliveredAsset,
} from "../fieldtypes/image-assets.js";
import { ensureSiteSettings } from "../globals/default-globals.js";
import { ensureMainMenu } from "../navigation/default-navigation.js";
import { writeSetting } from "../settings/settings.service.js";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { buildSiteServer } from "./site-server.js";

const SITE_URL = "http://localhost:3999";

const photo: DeliveredAsset = {
  id: "6f1c2a8e-4b3d-4c5e-9f00-0a1b2c3d4e5f",
  url: "http://localhost:4000/media/6f1c2a8e-4b3d-4c5e-9f00-0a1b2c3d4e5f/file?v=abc",
  alt: "Fresh loaves",
  width: 2000,
  height: 1200,
  focalPoint: { x: 0.4, y: 0.6 },
};

function richText(text: string) {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text, marks: [] }] }],
  };
}

describe("the built-in website", () => {
  const testDatabase = useTestDatabase();
  let api: FastifyInstance;
  let site: FastifyInstance;
  let admin: SendRequest;

  beforeEach(async () => {
    const assetLookup: AssetLookup = {
      findAssetsByIds: async (ids) => new Map(ids.includes(photo.id) ? [[photo.id, photo]] : []),
    };
    api = await startTestServer(testDatabase.activeDatabase, {
      assetLookup,
      assetExists: acceptAnyAsset,
      website: { builtInSiteUrl: SITE_URL },
    });
    site = buildSiteServer({ api });
    await site.ready();
    // A site from before page designs: its pages have Page sections.
    await ensureCollection(testDatabase.database, pagesWithSimpleSectionsCollection);
    await ensureSiteSettings(testDatabase.database);
    await ensureMainMenu(testDatabase.database);
    await createTestUser(testDatabase.database, "owner@example.com", [["*"]]);
    admin = requestsAs(api, await signInAndGetCookies(api, "owner@example.com"));
    await admin("PATCH", "/globals/site_settings/values", {
      data: { site_name: "Corner Bakery", footer_text: "Fresh bread every morning." },
    });
  });

  afterEach(async () => {
    await site.close();
    await api.close();
  });

  function visit(url: string, headers: Record<string, string> = {}) {
    return site.inject({ method: "GET", url, headers });
  }

  async function publish(collection: string, data: Record<string, unknown>, slug?: string) {
    const created = await admin("POST", `/collections/${collection}/entries`, {
      data,
      ...(slug ? { slug } : {}),
    });
    expect(created.statusCode, created.body).toBe(201);
    const published = await admin("POST", `/entries/${created.json().id}/publish`);
    expect(published.statusCode, published.body).toBe(200);
    return created.json().id as string;
  }

  /**
   * The first page at the top of the tree is the site's "/"; pages after it answer under
   * their own slug ("/about"), as before there were site starts.
   */
  function publishHome() {
    return publish("pages", { title: "Home" }, "home");
  }

  it("welcomes a brand new site until its first page is published", async () => {
    const response = await visit("/");
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("This website has no home page yet");
    expect(response.headers["content-type"]).toBe("text/html; charset=utf-8");
  });

  it("says the home page isn't published when only a page under it is", async () => {
    const home = await admin("POST", "/collections/pages/entries", {
      data: { title: "Home" },
      slug: "home",
    });
    const aboutId = await admin("POST", "/collections/pages/entries", {
      data: { title: "About us" },
      parentId: home.json().id,
    }).then((created) => created.json().id as string);
    await admin("POST", `/entries/${aboutId}/publish`);

    // Publishing a page alone is still allowed; the admin offers to publish its parent too.
    expect((await visit("/about-us")).statusCode).toBe(200);
    const front = await visit("/");
    expect(front.body).toContain("This website has no home page yet");
    expect(front.body).toContain("publish the first page at the top of the page tree");
    expect(front.body).not.toContain("ready for its first page");
  });

  it("renders a published page with its sections, the header, the footer and the theme", async () => {
    await publish(
      "pages",
      {
        title: "Home",
        sections: [
          {
            id: "0b6c1b1e-0d3e-4c1e-9f00-000000000001",
            type: "hero",
            data: {
              heading: "Bread worth getting up for",
              image: photo.id,
              button: { url: "/menu", label: "See the menu" },
            },
          },
          {
            id: "0b6c1b1e-0d3e-4c1e-9f00-000000000002",
            type: "faq",
            data: { question: "Do you deliver?", answer: richText("Every morning.") },
          },
        ],
      },
      "home",
    );

    const response = await visit("/");
    expect(response.statusCode).toBe(200);
    const page = response.body;
    expect(page).toContain('<html lang="en-GB">');
    expect(page).toContain("<title>Home | Corner Bakery</title>");
    expect(page).toContain(`<link rel="canonical" href="${SITE_URL}/"/>`);
    expect(page).toContain('<h1 id="hero-0b6c1b1e-0d3e-4c1e-9f00-000000000001"');
    expect(page).toContain("w=2000&amp;h=1125&amp;fit=cover&amp;format=webp");
    expect(page).toContain(
      '<summary class="lintel-faq__question" data-lintel-field="question">Do you deliver?</summary>',
    );
    expect(page).toContain("Fresh bread every morning.");
    expect(page).not.toContain("<script");

    const stylesheet = /<link rel="stylesheet" href="([^"]+)"/.exec(page)?.[1] ?? "";
    const css = await visit(stylesheet);
    expect(css.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect(css.body).toContain("--lintel-color-brand: #7539fd;");

    // The page's own address sends visitors to the home page's.
    const home = await visit("/home");
    expect(home.statusCode).toBe(301);
    expect(home.headers.location).toBe("/");
  });

  it("shows a page's design from the page builder in place of its sections", async () => {
    const design = createEmptyPage();
    design.root.children = [
      createNode(
        { type: "heading", props: { text: "Bread, baked at dawn", level: 1 } },
        standardCatalogue,
        () => "h1",
      ),
    ];
    await publishHome();
    await publish("pages", { title: "Designed", design }, "designed");

    const response = await visit("/designed");

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('data-lintel-component="page_design"');
    expect(response.body).toMatch(/<h1[^>]*>Bread, baked at dawn<\/h1>/);
    expect(response.body).not.toContain("lintel-page-header__title");
  });

  it("answers again from its cache, with 304 for an unchanged page, and refreshes on publish", async () => {
    await publishHome();
    const id = await publish("pages", { title: "About us", summary: "Who we are." });
    const first = await visit("/about-us");
    expect(first.body).toContain("Who we are.");
    expect(api.website.renderedPages.size).toBe(1);

    const again = await visit("/about-us", { "if-none-match": String(first.headers.etag) });
    expect(again.statusCode).toBe(304);

    await admin("PATCH", `/entries/${id}`, { data: { summary: "Three generations of bakers." } });
    expect(api.website.renderedPages.size).toBe(0);
    // Saving isn't publishing: the site still shows the published copy.
    expect((await visit("/about-us")).body).toContain("Who we are.");

    await admin("POST", `/entries/${id}/publish`);
    expect((await visit("/about-us")).body).toContain("Three generations of bakers.");
  });

  it("shows a friendly 404, and tidies addresses with a trailing slash", async () => {
    const missing = await visit("/no-such-page");
    expect(missing.statusCode).toBe(404);
    expect(missing.body).toContain("We couldn’t find that page");
    expect(missing.body).toContain('<meta name="robots" content="noindex"/>');

    const slash = await visit("/about/");
    expect(slash.statusCode).toBe(301);
    expect(slash.headers.location).toBe("/about");
  });

  it("lists blog posts ten a page, with archives for categories and tags", async () => {
    await ensureBlogPostsCollection(testDatabase.database);
    const term = await admin("POST", "/taxonomies/categories/terms", { title: "Recipes" });
    for (let number = 1; number <= 12; number += 1) {
      await publish("posts", {
        title: `Post ${number}`,
        excerpt: `About post ${number}`,
        body: richText("Hello"),
        categories: number % 2 === 0 ? [term.json().id] : [],
      });
    }

    const firstPage = await visit("/blog");
    expect(firstPage.statusCode).toBe(200);
    expect(firstPage.body.match(/class="lintel-post-card /g)).toHaveLength(10);
    expect(firstPage.body).toContain(
      '<a class="lintel-pagination__link" href="/blog/page/2" rel="next">',
    );
    const secondPage = await visit("/blog/page/2");
    expect(secondPage.body.match(/class="lintel-post-card /g)).toHaveLength(2);
    expect((await visit("/blog/page/3")).statusCode).toBe(404);

    const archive = await visit("/blog/categories/recipes");
    expect(archive.body).toContain('<h1 class="lintel-page-header__title">Recipes</h1>');
    expect(archive.body.match(/class="lintel-post-card /g)).toHaveLength(6);
    expect((await visit("/blog/categories/cakes")).statusCode).toBe(404);

    const post = await visit("/blog/post-2");
    expect(post.body).toContain('<meta property="og:type" content="article"/>');
    expect(post.body).toContain(
      '<a class="lintel-terms__link" href="/blog/categories/recipes">Recipes</a>',
    );
    // With no home page, the home page shows the newest posts.
    expect((await visit("/")).body).toContain("Post 12");
  }, 60_000);

  it("shows a draft with a preview token, without caching it, and explains a bad token", async () => {
    await publishHome();
    const id = await publish("pages", { title: "Prices", summary: "Published prices" });
    await admin("PATCH", `/entries/${id}`, { data: { summary: "New prices, not yet live" } });

    const preview = await admin("POST", `/entries/${id}/preview`);
    expect(preview.json().previewUrl).toMatch(new RegExp(`^${SITE_URL}/prices\\?preview=`));
    const previewPath = String(preview.json().previewUrl).slice(SITE_URL.length);

    const draft = await visit(previewPath);
    expect(draft.statusCode).toBe(200);
    expect(draft.body).toContain("New prices, not yet live");
    expect(draft.headers["cache-control"]).toBe("private, no-store");
    expect(draft.headers["x-robots-tag"]).toBe("noindex");
    expect((await visit("/prices")).body).toContain("Published prices");

    const broken = await visit("/prices?preview=not-a-token");
    expect(broken.statusCode, broken.body.slice(-1500)).toBe(401);
    expect(broken.body, broken.body.slice(-1500)).toContain("Open the preview again");
  });

  it("serves other languages under their prefix, with links between translations", async () => {
    await admin("POST", "/locales", { code: "fr-FR", name: "Français" });
    const home = await publishHome();
    const frenchHome = await admin("POST", `/entries/${home}/translations`, { locale: "fr-FR" });
    await admin("POST", `/entries/${frenchHome.json().id}/publish`);
    const id = await publish("pages", { title: "About" }, "about");
    const translation = await admin("POST", `/entries/${id}/translations`, { locale: "fr-FR" });
    await admin("PATCH", `/entries/${translation.json().id}`, { data: { title: "À propos" } });
    await admin("POST", `/entries/${translation.json().id}/publish`);

    const french = await visit("/fr-FR/about");
    expect(french.statusCode).toBe(200);
    expect(french.body).toContain('<html lang="fr-FR">');
    expect(french.body).toContain("À propos");
    expect(french.body).toContain(
      `<link rel="alternate" hreflang="en-GB" href="${SITE_URL}/about"/>`,
    );
    expect(french.body, french.body.slice(-1200)).toContain(
      'href="/about" lang="en-GB" hreflang="en-GB">British English</a>',
    );
  });

  it("honours redirects and serves the sitemap and robots.txt with the SEO plugin on", async () => {
    await admin("PUT", "/plugins", { enabled: ["seo"] });
    await publishHome();
    await publish("pages", { title: "Contact" });
    await admin("POST", "/seo/redirects", { fromPath: "/get-in-touch", toPath: "/contact" });

    const redirected = await visit("/get-in-touch");
    expect(redirected.statusCode).toBe(301);
    expect(redirected.headers.location).toBe("/contact");

    const sitemap = await visit("/sitemap.xml");
    expect(sitemap.headers["content-type"]).toBe("application/xml; charset=utf-8");
    expect(sitemap.body).toContain(`<loc>${SITE_URL}/contact</loc>`);
    expect((await visit("/robots.txt")).body).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
  });

  it("leaves out the sitemap while the SEO plugin is off", async () => {
    expect((await visit("/sitemap.xml")).statusCode).toBe(404);
  });

  describe("settings", () => {
    it("pick a template from the site type, and the site address defaults to the built-in site", async () => {
      await writeSetting(testDatabase.database, "siteType", "blog");
      const response = await admin("GET", "/website");
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        template: "journal",
        siteAddress: "",
        effectiveSiteAddress: SITE_URL,
        builtInSiteUrl: SITE_URL,
      });
      expect(response.json().templates.map((template: { id: string }) => template.id)).toEqual([
        "clean",
        "journal",
      ]);
    });

    it("change the theme, which the site uses straight away", async () => {
      await publish("pages", { title: "Home" }, "home");
      await visit("/");
      const saved = await admin("PUT", "/website", {
        template: "journal",
        brandColour: "#FF2D55",
        colourScheme: "dark",
        siteAddress: "https://www.cornerbakery.example/",
      });
      expect(saved.statusCode, saved.body).toBe(200);
      expect(saved.json().theme).toMatchObject({ brandColour: "#ff2d55", colourScheme: "dark" });
      expect(saved.json().effectiveSiteAddress).toBe("https://www.cornerbakery.example");

      const page = (await visit("/")).body;
      expect(page).toContain("lintel-template-journal");
      expect(page).toContain('<link rel="canonical" href="https://www.cornerbakery.example/"/>');
      const stylesheet = /<link rel="stylesheet" href="([^"]+)"/.exec(page)?.[1] ?? "";
      const css = (await visit(stylesheet)).body;
      expect(css).toContain("color-scheme: dark;");
      expect(css).toContain("--lintel-color-brand: #ff2d55;");
    });

    it("refuse a template that isn't installed, and need permission to change", async () => {
      const unknown = await admin("PUT", "/website", { template: "missing" });
      expect(unknown.statusCode).toBe(400);
      expect(unknown.json().fields.template).toMatch(/isn't installed/);

      await createTestUser(testDatabase.database, "editor@example.com", [["settings:read"]]);
      const editor = requestsAs(api, await signInAndGetCookies(api, "editor@example.com"));
      expect((await editor("GET", "/website")).statusCode).toBe(200);
      expect((await editor("GET", "/website/address")).json()).toEqual({
        siteAddress: SITE_URL,
        defaultLocale: "en-GB",
      });
      expect((await editor("PUT", "/website", { template: "clean" })).statusCode).toBe(403);
    });
  });
});
