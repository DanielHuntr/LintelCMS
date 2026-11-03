import {
  createEmptyPage,
  createNode,
  findSectionTemplate,
  type PageDocument,
  pageLinkHref,
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

  /** Changes the sections and publishes them, as the builder and a page's Publish do. */
  async function putLive(change: object) {
    const saved = await owner("PUT", "/website/sections", change);
    expect(saved.statusCode, saved.body).toBe(200);
    const published = await owner("POST", "/website/sections/publish");
    expect(published.statusCode, published.body).toBe(200);
    return saved;
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
      unpublished: false,
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
    const saved = await putLive({ navigation });
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
    await putLive(starterSiteSections());

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
    await putLive(starterSiteSections());
    const body = await visit("/about");
    // The link carries its Menu link's class and its menu item's id (LINTEL-UX-078).
    expect(body).toMatch(
      /<a class="[^"]*menu-link" href="\/about" aria-current="page" data-menu-item="5b0e1c52-3f4a-4c55-9d2e-6c1f0a7b8e91">About<\/a>/,
    );
  });

  it("links 'Choose a page' buttons in the navigation and footer to the page's address", async () => {
    await publish("Home", "home");
    const aboutId = await publish("About", "about");
    const draft = await owner("POST", "/collections/pages/entries", {
      data: { title: "Soon" },
      slug: "soon",
    });
    const { navigation, footer } = starterSiteSections();
    const button = (id: string, href: string) => ({
      id,
      type: "button",
      name: id,
      props: { label: id, href },
      styles: { base: {} },
      children: [],
    });
    await putLive({
      navigation: {
        ...navigation!,
        children: [...navigation!.children, button("aboutlink", pageLinkHref(aboutId))],
      },
      footer: {
        ...footer!,
        children: [
          ...footer!.children,
          button("draftlink", pageLinkHref(draft.json().id)),
          button("filelink", "/_lintel/files/menu.pdf"),
          button("pdflink", "/menu.pdf"),
        ],
      },
    });
    const body = await visit("/");
    expect(body).not.toContain("lintel:page/");
    expect(body).toMatch(/<a[^>]*href="\/about"[^>]*>[\s\S]*?aboutlink/);
    expect(body).toContain('href="/_lintel/files/menu.pdf"');
    expect(body).toContain('href="/menu.pdf"');
    // A page that isn't published has no address to link to.
    expect(body).not.toContain("/soon");
  });

  it("links 'Choose a page' buttons inside the site's own blocks to the page's address", async () => {
    const aboutId = await publish("About", "about");
    const made = await owner("POST", "/blocks", {
      name: "Call to action",
      icon: "box",
      category: "Marketing",
      properties: [],
      design: {
        id: "cta",
        type: "box",
        name: "Call to action",
        children: [
          {
            id: "go",
            type: "button",
            name: "Go",
            props: { label: "Read about us", href: pageLinkHref(aboutId) },
          },
        ],
      },
    });
    expect(made.statusCode, made.body).toBe(201);
    const page = createEmptyPage();
    await publish("Landing", "landing", {
      ...page,
      root: {
        ...page.root,
        children: [
          {
            id: "i1",
            type: "customBlock",
            name: "Call to action",
            props: { block: made.json().handle, values: {} },
            styles: { base: {} },
            children: [],
            hidden: false,
            locked: false,
          },
        ],
      },
    });
    const body = await visit("/landing");
    expect(body).toContain("Read about us");
    expect(body).not.toContain("lintel:page/");
    // About is the site's first page, so its address is the home page's.
    expect(body).toMatch(/<a class="go" href="\/">Read about us<\/a>/);
  });

  it("goes back to the automatic header when the navigation is taken off the site", async () => {
    await publish("Home", "home");
    await putLive(starterSiteSections());
    await putLive({ navigation: null });
    expect(chromeOf(await visit("/"))).toMatchObject({ automaticHeader: 1, siteFooter: 1 });
  });

  it("keeps changes as a draft until they are published, then shows them on every page", async () => {
    await publish("Home", "home");
    const saved = await owner("PUT", "/website/sections", starterSiteSections());
    expect(saved.json()).toMatchObject({ unpublished: true });
    // The builder sees the change; visitors don't yet.
    const draft = (await owner("GET", "/website/sections")).json();
    expect(draft).toMatchObject({ unpublished: true, navigation: { id: "site-navigation" } });
    expect(chromeOf(await visit("/"))).toMatchObject({ automaticHeader: 1, siteNavigation: 0 });

    const published = await owner("POST", "/website/sections/publish");
    expect(published.json()).toEqual({ published: true });
    expect(chromeOf(await visit("/"))).toMatchObject({ automaticHeader: 0, siteNavigation: 1 });
    expect((await owner("GET", "/website/sections")).json().unpublished).toBe(false);
    // Nothing left to publish.
    expect((await owner("POST", "/website/sections/publish")).json()).toEqual({
      published: false,
    });
  });

  it("has nothing to publish once a change is put back as it was", async () => {
    await putLive(starterSiteSections());
    const live = (await owner("GET", "/website/sections")).json();
    await owner("PUT", "/website/sections", { footer: null });
    const back = await owner("PUT", "/website/sections", { footer: live.footer });
    expect(back.json().unpublished).toBe(false);
  });

  it("publishes them only for people who may change blocks and publish", async () => {
    await createTestUser(testDatabase.database, "builder@example.com", [
      ["entries:read", "builder:blocks"],
    ]);
    const builder = requestsAs(api, await signInAndGetCookies(api, "builder@example.com"));
    await builder("PUT", "/website/sections", starterSiteSections());
    expect((await builder("POST", "/website/sections/publish")).statusCode).toBe(403);
    expect((await writer("POST", "/website/sections/publish")).statusCode).toBe(403);
  });

  it("needs the permission to change blocks, and checks what is sent", async () => {
    const refused = await writer("PUT", "/website/sections", starterSiteSections());
    expect(refused.statusCode).toBe(403);
    const broken = await owner("PUT", "/website/sections", {
      navigation: { id: "x", type: "nothing-like-this", props: {}, children: [] },
    });
    expect(broken.statusCode).toBe(400);
  });

  it("gives a starter template's pages a shared navigation and footer", async () => {
    const applied = await owner("POST", "/starter-sites/bakery/apply", { publish: true });
    expect(applied.statusCode, applied.body).toBe(201);
    expect(chromeOf(await visit("/"))).toEqual({
      automaticHeader: 0,
      automaticFooter: 0,
      siteNavigation: 1,
      siteFooter: 1,
    });
  });

  it("uses a starter template's own navigation and footer, on every page and not in them", async () => {
    await putLive(starterSiteSections());
    const applied = await owner("POST", "/starter-sites/folio/apply", {
      publish: true,
      useTheme: true,
    });
    expect(applied.statusCode, applied.body).toBe(201);
    const sections = (await owner("GET", "/website/sections")).json();
    expect(JSON.stringify(sections.navigation)).toContain("Europe/Lisbon");
    for (const url of ["/", "/projects"]) {
      const body = await visit(url);
      expect(chromeOf(body)).toMatchObject({ automaticHeader: 0, automaticFooter: 0 });
      expect((body.match(/<header /g) ?? []).length, url).toBe(1);
      expect(body.indexOf('data-lintel-component="site_section"')).toBeLessThan(
        body.indexOf("<main"),
      );
    }
  });

  it("never changes the site's own menu and footer when a template is added beside its pages", async () => {
    await publish("Home", "home");
    await putLive({
      navigation: designed("navigation-centred").root.children[0],
    });
    const before = (await owner("GET", "/website/sections")).json();
    const applied = await owner("POST", "/starter-sites/folio/apply", {
      useTheme: true,
      existingPages: "alongside",
    });
    expect(applied.statusCode, applied.body).toBe(201);
    expect(applied.json().previousSectionsKept).toBe(false);
    expect((await owner("GET", "/website/sections")).json()).toEqual(before);
  });

  it("keeps the site's menu and footer when a template replaces its pages, to bring back", async () => {
    await publish("Home", "home");
    await putLive({
      navigation: designed("navigation-centred").root.children[0],
    });
    const before = (await owner("GET", "/website/sections")).json();
    const applied = await owner("POST", "/starter-sites/folio/apply", {
      useTheme: true,
      existingPages: "replace",
    });
    expect(applied.statusCode, applied.body).toBe(201);
    expect(applied.json().previousSectionsKept).toBe(true);
    const replaced = (await owner("GET", "/website/sections")).json();
    expect(JSON.stringify(replaced.navigation)).toContain("Europe/Lisbon");

    expect((await writer("POST", "/website/sections/restore-previous")).statusCode).toBe(403);
    const restored = await owner("POST", "/website/sections/restore-previous");
    expect(restored.statusCode, restored.body).toBe(200);
    expect(restored.json()).toEqual(before);
    // Doing it again puts the template's back.
    const again = await owner("POST", "/website/sections/restore-previous");
    expect(again.json()).toEqual(replaced);
  });

  it("says plainly when there is nothing to bring back", async () => {
    const response = await owner("POST", "/website/sections/restore-previous");
    expect(response.statusCode).toBe(404);
    expect(response.json().code).toBe("NO_PREVIOUS_SECTIONS");
  });

  it("only lets people who may change blocks replace the menu and footer with a template's", async () => {
    await createTestUser(testDatabase.database, "designer@example.com", [
      ["entries:*", "builder:design", "settings:update", "navigation:update"],
    ]);
    const designer = requestsAs(api, await signInAndGetCookies(api, "designer@example.com"));
    await putLive(starterSiteSections());
    const before = (await owner("GET", "/website/sections")).json();
    const applied = await designer("POST", "/starter-sites/folio/apply", { useTheme: true });
    expect(applied.statusCode, applied.body).toBe(201);
    expect(applied.json()).toMatchObject({ themeApplied: true, previousSectionsKept: false });
    expect((await owner("GET", "/website/sections")).json()).toEqual(before);
  });

  it("gives a site made in Websites and domains its own starter sections", async () => {
    const created = await owner("POST", "/sites", {
      handle: "france",
      name: "Acme France",
      hostnames: ["acme.fr"],
      siteUrl: "https://www.acme.fr",
      defaultLocale: "fr-FR",
    });
    expect(created.statusCode, created.body).toBe(201);
    const france = await owner("GET", "/website/sections?site=france");
    expect(france.json().navigation.id).toBe("site-navigation");
    // The first site, set up before sections existed, keeps its automatic header.
    expect((await owner("GET", "/website/sections")).json().navigation).toBeNull();
  });

  it("gives a new site its starter navigation and footer, but never replaces a site's own", async () => {
    const database = testDatabase.database;
    const defaultSite = await findOrCreateDefaultSite(database);
    expect(await ensureStarterSiteSections(database, defaultSite)).toBe(true);
    const first = await readSiteSections(database, defaultSite);
    expect(first.navigation?.props.element).toBe("header");
    expect(first.footer?.props.element).toBe("footer");
    await putLive({ footer: null });
    expect(await ensureStarterSiteSections(database, defaultSite)).toBe(false);
    expect((await readSiteSections(database, defaultSite)).footer).toBeNull();
  });
});
