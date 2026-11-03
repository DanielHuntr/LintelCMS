import {
  createEmptyPage,
  createNode,
  findSectionTemplate,
  type PageDocument,
} from "@lintel/builder-model";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensurePagesCollection } from "../collections/default-collections.js";
import { acceptAnyAsset } from "../fieldtypes/image-assets.js";
import { ensureSiteSettings } from "../globals/default-globals.js";
import { ensureMainMenu } from "../navigation/default-navigation.js";
import { pageComponentCatalogue } from "../pages/page-components.js";
import { findOrCreateDefaultSite } from "../sites/sites.service.js";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { buildSiteServer } from "../website/site-server.js";
import {
  ensureStarterSiteSections,
  readSiteSections,
  starterSiteSections,
} from "./site-sections.service.js";

let counter = 0;
const nextId = () => `p${(counter += 1)}`;

function designed(templateId: string, props: Record<string, unknown> = {}): PageDocument {
  const page = createEmptyPage();
  const section = createNode(
    findSectionTemplate(templateId)!.blueprint,
    pageComponentCatalogue,
    nextId,
  );
  return { ...page, root: { ...page.root, props, children: [section] } };
}

/** How many of each kind of header and footer a page has. */
function chromeOf(body: string) {
  return {
    automaticHeader: (body.match(/class="lintel-header[ "]/g) ?? []).length,
    automaticFooter: (body.match(/class="lintel-footer[ "]/g) ?? []).length,
    siteNavigation: (body.match(/<header class="site-navigation/g) ?? []).length,
    siteFooter: (body.match(/<footer class="site-footer/g) ?? []).length,
  };
}

describe("the site's navigation and footer sections", () => {
  const testDatabase = useTestDatabase();
  let api: FastifyInstance;
  let site: FastifyInstance;
  let owner: SendRequest;
  let writer: SendRequest;

  beforeEach(async () => {
    api = await startTestServer(testDatabase.activeDatabase, { assetExists: acceptAnyAsset });
    site = buildSiteServer({ api });
    await site.ready();
    await ensurePagesCollection(testDatabase.database);
    await ensureSiteSettings(testDatabase.database);
    await ensureMainMenu(testDatabase.database);
    await createTestUser(testDatabase.database, "owner@example.com", [["*"]]);
    await createTestUser(testDatabase.database, "writer@example.com", [["entries:*"]]);
    owner = requestsAs(api, await signInAndGetCookies(api, "owner@example.com"));
    writer = requestsAs(api, await signInAndGetCookies(api, "writer@example.com"));
  });

  afterEach(async () => {
    await site.close();
    await api.close();
  });

  async function publish(title: string, slug: string, design?: PageDocument) {
    const created = await owner("POST", "/collections/pages/entries", {
      data: { title, ...(design ? { design } : {}) },
      slug,
    });
    expect(created.statusCode, created.body).toBe(201);
    const published = await owner("POST", `/entries/${created.json().id}/publish`);
    expect(published.statusCode, published.body).toBe(200);
    return created.json().id as string;
  }

  async function visit(url: string) {
    const response = await site.inject({ method: "GET", url });
    expect(response.statusCode, response.body).toBe(200);
    return response.body;
  }

  it("starts with none, so a site keeps its automatic header and footer until it adds one", async () => {
    expect((await writer("GET", "/website/sections")).json()).toEqual({
      navigation: null,
      footer: null,
    });
    await publish("Home", "home");
    expect(chromeOf(await visit("/"))).toEqual({
      automaticHeader: 1,
      automaticFooter: 1,
      siteNavigation: 0,
      siteFooter: 0,
    });
  });

  it("shows a navigation added once on every page, in place of the automatic header", async () => {
    await publish("Home", "home");
    await publish("About", "about", designed("questions"));
    const { navigation } = starterSiteSections();
    const saved = await owner("PUT", "/website/sections", { navigation });
    expect(saved.statusCode, saved.body).toBe(200);
    expect(saved.json().navigation.id).toBe("site-navigation");

    for (const url of ["/", "/about"]) {
      const body = await visit(url);
      expect(chromeOf(body)).toEqual({
        automaticHeader: 0,
        automaticFooter: 1,
        siteNavigation: 1,
        siteFooter: 0,
      });
      // Before <main>, after the skip link, so it is the page's banner.
      const banner = body.indexOf('<header class="site-navigation');
      expect(banner).toBeLessThan(body.indexOf("<main"));
      expect(body.indexOf('class="lintel-skip-link"')).toBeLessThan(banner);
    }
    // The page's own design isn't stored with the navigation in it.
    const pages = await owner("GET", "/collections/pages/entries");
    expect(pages.body).not.toContain("site-navigation");
  });

  it("leaves it off a page that hides it, and never doubles a page's own header", async () => {
    await publish("Home", "home");
    await publish("Hidden", "hidden", designed("questions", { hideSiteNavigation: true }));
    await publish("Own", "own", designed("navigation-centred"));
    await owner("PUT", "/website/sections", starterSiteSections());

    expect(chromeOf(await visit("/hidden"))).toMatchObject({ siteNavigation: 0, siteFooter: 1 });
    const own = await visit("/own");
    expect(chromeOf(own)).toMatchObject({ automaticHeader: 0, siteNavigation: 0, siteFooter: 1 });
    expect((own.match(/<header /g) ?? []).length).toBe(1);
  });

  it("marks the current page in the navigation's menu", async () => {
    await publish("Home", "home");
    const aboutId = await publish("About", "about");
    await owner("PUT", "/navigation/main", {
      items: [{ id: "5b0e1c52-3f4a-4c55-9d2e-6c1f0a7b8e91", entryId: aboutId, newTab: false }],
    });
    await owner("PUT", "/website/sections", starterSiteSections());
    const body = await visit("/about");
    expect(body).toMatch(/<a href="\/about" aria-current="page">About<\/a>/);
  });

  it("goes back to the automatic header when the navigation is taken off the site", async () => {
    await publish("Home", "home");
    await owner("PUT", "/website/sections", starterSiteSections());
    await owner("PUT", "/website/sections", { navigation: null });
    expect(chromeOf(await visit("/"))).toMatchObject({ automaticHeader: 1, siteFooter: 1 });
  });

  it("needs the permission to change blocks, and checks what is sent", async () => {
    const refused = await writer("PUT", "/website/sections", starterSiteSections());
    expect(refused.statusCode).toBe(403);
    const broken = await owner("PUT", "/website/sections", {
      navigation: { id: "x", type: "nothing-like-this", props: {}, children: [] },
    });
    expect(broken.statusCode).toBe(400);
  });

  it("gives a new site its starter navigation and footer, but never replaces a site's own", async () => {
    const database = testDatabase.database;
    const defaultSite = await findOrCreateDefaultSite(database);
    expect(await ensureStarterSiteSections(database, defaultSite)).toBe(true);
    const first = await readSiteSections(database, defaultSite);
    expect(first.navigation?.props.element).toBe("header");
    expect(first.footer?.props.element).toBe("footer");
    await owner("PUT", "/website/sections", { footer: null });
    expect(await ensureStarterSiteSections(database, defaultSite)).toBe(false);
    expect((await readSiteSections(database, defaultSite)).footer).toBeNull();
  });
});
