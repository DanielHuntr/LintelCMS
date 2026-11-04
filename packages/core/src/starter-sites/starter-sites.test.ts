import { motionCloakCss as runtimeCloakCss } from "@lintel/motion";
import { motionCloakCss } from "@lintel/site-components";
import { findStarterSite, type StarterSite } from "@lintel/builder-model";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensurePagesCollection } from "../collections/default-collections.js";
import { acceptAnyAsset } from "../fieldtypes/image-assets.js";
import { ensureSiteSettings } from "../globals/default-globals.js";
import { ensureMainMenu } from "../navigation/default-navigation.js";
import { writeSetting } from "../settings/settings.service.js";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { buildSiteServer } from "../website/site-server.js";

const SITE_URL = "http://localhost:3998";

describe("starting from a template", () => {
  const testDatabase = useTestDatabase();
  let api: FastifyInstance;
  let site: FastifyInstance;
  let owner: SendRequest;

  beforeEach(async () => {
    api = await startTestServer(testDatabase.activeDatabase, {
      assetExists: acceptAnyAsset,
      website: { builtInSiteUrl: SITE_URL },
    });
    site = buildSiteServer({ api });
    await site.ready();
    await ensureSiteSettings(testDatabase.database);
    await ensureMainMenu(testDatabase.database);
    await createTestUser(testDatabase.database, "owner@example.com", [["*"]]);
    owner = requestsAs(api, await signInAndGetCookies(api, "owner@example.com"));
  });

  afterEach(async () => {
    await site.close();
    await api.close();
  });

  const visit = (url: string) => site.inject({ method: "GET", url });

  it("makes the template's pages, publishes them, fills the menu and takes its theme", async () => {
    const response = await owner("POST", "/starter-sites/bakery/apply", { publish: true });
    expect(response.statusCode, response.body).toBe(201);
    const applied = response.json();
    expect(applied.pages.map((page: { slug: string }) => page.slug)).toEqual([
      "home",
      "menu",
      "about",
      "visit",
    ]);
    expect(applied.pages.every((page: { published: boolean }) => page.published)).toBe(true);
    expect(applied).toMatchObject({ themeApplied: true, menuFilled: true });

    const website = await owner("GET", "/website");
    expect(website.json().theme).toMatchObject({ brandColour: "#a8502a", fontPairing: "classic" });
    const menu = await owner("GET", "/navigation/main");
    expect(menu.json().items).toHaveLength(4);

    const home = await visit("/");
    expect(home.statusCode).toBe(200);
    expect(home.body).toContain("Bread worth getting up for");
    expect(home.body).toContain('class="lintel-design"');
    expect(home.body).toContain('src="/_lintel/illustrations/bakery-loaf.svg"');
    expect(home.body).toContain('href="/menu"');
  });

  it("switches on the blog the magazine's links lead to (LINTEL-FUNC-032)", async () => {
    await owner("PUT", "/plugins", { enabled: [] });
    const response = await owner("POST", "/starter-sites/magazine/apply", { publish: true });

    expect(response.json().featuresSwitchedOn).toEqual(["Blog"]);
    expect((await owner("GET", "/plugins")).json().plugins).toContainEqual(
      expect.objectContaining({ id: "blog", enabled: true }),
    );
    const again = await owner("POST", "/starter-sites/magazine/apply", {
      existingPages: "replace",
    });
    expect(again.json().featuresSwitchedOn).toEqual([]);
  });

  it("makes Folio with its fonts, its motion and a home page that says who it is for", async () => {
    const response = await owner("POST", "/starter-sites/folio/apply", { publish: true });
    expect(response.statusCode, response.body).toBe(201);
    const website = (await owner("GET", "/website")).json();
    expect(website).toMatchObject({ headingFont: "Archivo", bodyFont: "Archivo" });
    expect((await owner("GET", "/website/effects")).json()).toMatchObject({
      smoothScroll: { strength: "gentle" },
      cursor: { style: "dot" },
      pageTransition: { style: "fade" },
      intro: { style: "counter", text: "Ilse Moreau" },
    });

    const home = await visit("/");
    expect(home.statusCode).toBe(200);
    expect(home.body).toContain("I photograph rooms, objects and the hands that make them.");
    expect(home.body).toContain('data-behaviour="clock"');
    expect(home.body).toContain("data-free-drag");
    expect(home.body).toContain('src="/_lintel/illustrations/folio-window.svg"');
    // The page brings its own header, so the site's is left out.
    expect(home.body).not.toContain('class="lintel-header');
    const projects = await visit("/projects");
    expect(projects.body).toContain("Concrete Weather");
    const picture = await visit("/_lintel/illustrations/folio-portrait.svg");
    expect(picture.statusCode).toBe(200);
  });

  it("switches on the template's site-wide motion with its theme, keeping the rest", async () => {
    const bakery = findStarterSite("bakery") as StarterSite & { siteMotion?: unknown };
    bakery.siteMotion = {
      smoothScroll: { strength: "gentle" },
      cursor: { style: "ring" },
      pageTransition: { style: "fade" },
    };
    try {
      await owner("PUT", "/website/effects", { cursor: { style: "dot", size: 40 } });
      const response = await owner("POST", "/starter-sites/bakery/apply", { publish: true });
      expect(response.statusCode, response.body).toBe(201);
      const effects = (await owner("GET", "/website/effects")).json();
      expect(effects).toMatchObject({
        smoothScroll: { strength: "gentle" },
        cursor: { style: "ring", size: 40 },
        pageTransition: { style: "fade" },
        intro: { style: "none" },
      });
    } finally {
      delete bakery.siteMotion;
    }
  });

  it("applies Atelier with its fonts and motion, and a later template goes back to its pairing", async () => {
    const response = await owner("POST", "/starter-sites/atelier/apply", { publish: true });
    expect(response.statusCode, response.body).toBe(201);
    const website = (await owner("GET", "/website")).json();
    expect(website).toMatchObject({ headingFont: "Instrument Serif", bodyFont: "Work Sans" });
    const effects = (await owner("GET", "/website/effects")).json();
    expect(effects).toMatchObject({
      smoothScroll: { strength: "strong" },
      pageTransition: { style: "slide" },
      intro: { style: "name", text: "Wrenfold" },
    });

    const home = await visit("/");
    expect(home.statusCode).toBe(200);
    expect(home.body).toContain("Made slowly, kept for good");
    expect(home.body).toContain('src="/_lintel/illustrations/atelier-workshop.svg"');
    expect(home.body).toContain("Wrenfold");
    expect((await visit("/_lintel/illustrations/atelier-chair.svg")).statusCode).toBe(200);
    expect((await visit("/collection")).body).toContain("Hollin armchair");

    await owner("POST", "/starter-sites/bakery/apply", { existingPages: "replace" });
    expect((await owner("GET", "/website")).json()).toMatchObject({
      headingFont: null,
      bodyFont: null,
    });
  });

  it("gives its motion and design variables to the site being edited only", async () => {
    await owner("POST", "/sites", {
      handle: "france",
      name: "Acme France",
      defaultLocale: "fr-FR",
    });
    await owner("PUT", "/website/effects", { cursor: { style: "dot", size: 40 } });
    const mainDesign = (await owner("GET", "/website/design")).json();
    const response = await owner("POST", "/starter-sites/studio/apply?site=france", {
      publish: true,
    });
    expect(response.statusCode, response.body).toBe(201);

    const french = (await owner("GET", "/website/effects?site=france")).json();
    expect(french.smoothScroll.strength).not.toBe("off");
    expect((await owner("GET", "/website/design?site=france")).json().variables).not.toEqual([]);
    expect((await owner("GET", "/website/effects")).json()).toMatchObject({
      cursor: { style: "dot", size: 40 },
      smoothScroll: { strength: "off" },
      pageTransition: { style: "none" },
    });
    expect((await owner("GET", "/website/design")).json()).toEqual(mainDesign);
  });

  it("applies Studio: its fonts, motion and a home page led by the studio's name", async () => {
    const response = await owner("POST", "/starter-sites/studio/apply", { publish: true });
    expect(response.statusCode, response.body).toBe(201);
    expect(response.json().pages.map((page: { slug: string }) => page.slug)).toEqual([
      "home",
      "work",
      "studio",
      "contact",
    ]);
    expect((await owner("GET", "/website")).json()).toMatchObject({
      headingFont: "Space Grotesk",
      bodyFont: "Inter",
      theme: { brandColour: "#2447d6", cornerStyle: "square" },
    });
    expect((await owner("GET", "/website/effects")).json()).toMatchObject({
      smoothScroll: { strength: "gentle" },
      cursor: { style: "ring", colour: "text" },
      pageTransition: { style: "fade" },
    });
    const home = await visit("/");
    expect(home.statusCode).toBe(200);
    expect(home.body).toContain("Corran Wade");
    expect(home.body).toContain("Selected work");
    expect(home.body).toContain("Maasbad");
    expect(home.body).toContain("--lintel-var-cobalt");
    const design = (await owner("GET", "/website/design")).json();
    expect(design.variables).toContainEqual(
      expect.objectContaining({ id: "cobalt", value: "#2447d6", darkValue: "#7d95ff" }),
    );
    expect(home.body).toContain('href="/work"');
    expect(home.body).toContain('src="/_lintel/illustrations/studio-house.svg"');
    const drawing = await visit("/_lintel/illustrations/studio-workshop.svg");
    expect(drawing.statusCode).toBe(200);
  });

  it("plays animations with the motion runtime, only on pages that have them", async () => {
    await owner("POST", "/starter-sites/consultant/apply", { publish: true });
    const home = await visit("/");
    const script = /<script src="(\/_lintel\/motion-[0-9a-f]{12}\.js)" defer="">/.exec(home.body);
    expect(script, home.body.slice(0, 2000)).not.toBeNull();
    expect(home.body).toContain('<script type="application/json" id="lintel-motion">');
    expect(home.body).toMatch(/data-node-id="[\w-]+" data-motion-cloak=""/);
    expect(home.body).toContain("[data-motion-cloak]");

    const runtime = await visit(script?.[1] ?? "");
    expect(runtime.statusCode).toBe(200);
    expect(runtime.headers["content-type"]).toContain("text/javascript");
    expect(runtime.body).toContain("lintelMotion");

    // A page with no design at all ships no motion; its only script is the elements script
    // the site's navigation needs for its Menu button on phones.
    const created = await owner("POST", "/collections/pages/entries", {
      data: { title: "Plain" },
      slug: "plain",
    });
    await owner("POST", `/entries/${created.json().id}/publish`);
    const plain = await visit("/plain");
    expect(plain.statusCode).toBe(200);
    const scripts = plain.body.match(/<script[^>]*>/g) ?? [];
    expect(scripts).toEqual([
      expect.stringMatching(/^<script src="\/_lintel\/elements-[^"]+" defer="">$/),
    ]);
  });

  it("keeps the website's cloak in step with the motion runtime's", () => {
    expect(motionCloakCss).toBe(runtimeCloakCss);
  });

  it("serves the illustrations, and nothing else from that folder", async () => {
    const picture = await visit("/_lintel/illustrations/bakery-loaf.svg");
    expect(picture.statusCode).toBe(200);
    expect(picture.headers["content-type"]).toBe("image/svg+xml");
    expect(picture.body.startsWith("<svg")).toBe(true);
    expect((await visit("/_lintel/illustrations/nope.svg")).statusCode).toBe(404);
    expect((await visit("/_lintel/illustrations/..%2Fsite.css")).statusCode).toBe(404);
  });

  it("leaves pages that exist alone, giving the template's the next free address", async () => {
    await ensurePagesCollection(testDatabase.database);
    await owner("POST", "/collections/pages/entries", {
      data: { title: "Our menu" },
      slug: "menu",
    });
    const asked = await owner("POST", "/starter-sites/bakery/apply", {});
    expect(asked.statusCode).toBe(409);
    expect(asked.json().code).toBe("SITE_HAS_PAGES");
    const existing = (await owner("GET", "/starter-sites/bakery/existing-pages")).json();
    expect(existing).toEqual({
      pageCount: 1,
      hasHome: true,
      addedCount: 3,
      clashes: [{ title: "Menu", slug: "menu", existingTitle: "Our menu" }],
    });

    const applied = (
      await owner("POST", "/starter-sites/bakery/apply", { existingPages: "alongside" })
    ).json();
    const menuPage = applied.pages.find(
      (page: { wantedSlug: string }) => page.wantedSlug === "menu",
    );
    expect(menuPage).toMatchObject({ slug: "menu-2", title: "Menu (2)", published: false });
    // The site keeps its one home page; the template's goes nowhere.
    expect(applied.skippedHome).toBe(true);
    expect(applied.pages.map((page: { wantedSlug: string }) => page.wantedSlug)).not.toContain(
      "home",
    );
    const tree = (await owner("GET", "/content-tree")).json();
    expect(tree.siteStartCount).toBe(1);
  });

  it("leaves the template's home page out of what it would add beside a home page", async () => {
    await ensurePagesCollection(testDatabase.database);
    await owner("POST", "/collections/pages/entries", { data: { title: "Home" }, slug: "home" });
    const existing = (await owner("GET", "/starter-sites/bakery/existing-pages")).json();
    expect(existing).toMatchObject({ hasHome: true, addedCount: 3, clashes: [] });
    const applied = (
      await owner("POST", "/starter-sites/bakery/apply", { existingPages: "alongside" })
    ).json();
    expect(applied.pages).toHaveLength(existing.addedCount);
    expect(applied.pages.map((page: { title: string }) => page.title)).not.toContain("Home (2)");
  });

  it("replaces the site's pages when asked, sending them to the recycle bin", async () => {
    const first = (await owner("POST", "/starter-sites/bakery/apply", {})).json();
    const second = await owner("POST", "/starter-sites/portfolio/apply", {
      existingPages: "replace",
    });
    expect(second.statusCode, second.body).toBe(201);
    expect(second.json()).toMatchObject({ replacedCount: first.pages.length, menuFilled: true });
    const bin = (await owner("GET", "/recycle-bin")).json();
    expect(bin.items.map((item: { title: string }) => item.title)).toEqual(["Home"]);
    const menu = (await owner("GET", "/navigation/main")).json();
    expect(menu.items).toHaveLength(second.json().pages.length);
    // The template's home starts the tree, and its other pages sit under it.
    const tree = (await owner("GET", "/content-tree")).json();
    expect(tree.siteStartCount).toBe(1);
    const homeId = second.json().pages[0].entryId;
    const under = (await owner("GET", `/content-tree/children?parentId=${homeId}`)).json();
    expect(under.total).toBe(second.json().pages.length - 1);
  });

  it("leaves everything as it was when the person cancels (asks again)", async () => {
    await owner("POST", "/starter-sites/bakery/apply", {});
    const before = (await owner("GET", "/content-tree")).json();
    expect((await owner("POST", "/starter-sites/portfolio/apply", {})).statusCode).toBe(409);
    expect((await owner("GET", "/content-tree")).json()).toEqual(before);
  });

  it("names the site in the header with the name it was given, not the template's", async () => {
    await writeSetting(testDatabase.database, "siteName", "Brightside Bakery");
    await owner("POST", "/starter-sites/bakery/apply", { publish: true });

    const home = await visit("/");
    expect(home.body).toContain("Brightside Bakery");
    expect(home.body).not.toContain("My website");
  });

  it("leaves a menu with links alone, then adds every page to it when asked", async () => {
    const first = (await owner("POST", "/starter-sites/bakery/apply", {})).json();
    const second = (
      await owner("POST", "/starter-sites/portfolio/apply", { existingPages: "alongside" })
    ).json();
    expect(second).toMatchObject({ menuFilled: false, menuHasLinks: true });

    const added = await owner("POST", "/starter-sites/menu", {
      entryIds: second.pages.map((page: { entryId: string }) => page.entryId),
    });
    expect(added.json()).toEqual({ added: second.pages.length });
    const menu = await owner("GET", "/navigation/main");
    expect(menu.json().items).toHaveLength(first.pages.length + second.pages.length);

    // Asking again adds nothing twice.
    const again = await owner("POST", "/starter-sites/menu", {
      entryIds: second.pages.map((page: { entryId: string }) => page.entryId),
    });
    expect(again.json()).toEqual({ added: 0 });
  });

  it("gives Local service's booking page a working contact form while Forms is on", async () => {
    await owner("PUT", "/plugins", { enabled: ["forms"] });
    const applied = (await owner("POST", "/starter-sites/local-service/apply", {})).json();
    const forms = (await owner("GET", "/forms")).json().forms;
    expect(forms.map((form: { handle: string }) => form.handle)).toEqual(["contact"]);
    const booking = applied.pages.find(
      (page: { wantedSlug: string }) => page.wantedSlug !== "home",
    );
    const pages = await Promise.all(
      applied.pages.map((page: { entryId: string }) => owner("GET", `/entries/${page.entryId}`)),
    );
    const designs = JSON.stringify(pages.map((page) => page.json().data.design));
    expect(designs).toContain('"type":"formEmbed"');
    expect(designs).toContain('"form":"contact"');
    expect(booking).toBeDefined();
  });

  it("leaves the form out of Local service's pages while Forms is off", async () => {
    const applied = (await owner("POST", "/starter-sites/local-service/apply", {})).json();
    const pages = await Promise.all(
      applied.pages.map((page: { entryId: string }) => owner("GET", `/entries/${page.entryId}`)),
    );
    expect(JSON.stringify(pages.map((page) => page.json().data.design))).not.toContain("formEmbed");
  });

  it("only does what the person may: an editor's pages stay drafts in the house style", async () => {
    await createTestUser(testDatabase.database, "editor@example.com", [
      ["entries:read", "entries:create", "entries:update", "builder:design"],
    ]);
    const editor = requestsAs(api, await signInAndGetCookies(api, "editor@example.com"));
    const response = await editor("POST", "/starter-sites/portfolio/apply", { publish: true });
    expect(response.statusCode, response.body).toBe(201);
    expect(response.json()).toMatchObject({ themeApplied: false, menuFilled: false });
    expect(response.json().pages.some((page: { published: boolean }) => page.published)).toBe(
      false,
    );
  });

  it("makes Threshold's listings collection with its homes, and lists them on its pages", async () => {
    const response = await owner("POST", "/starter-sites/threshold/apply", { publish: true });
    expect(response.statusCode, response.body).toBe(201);
    expect(response.json().collectionsMade).toEqual(["listings"]);
    const collection = (await owner("GET", "/collections/listings")).json();
    expect(collection).toMatchObject({ name: "Listings", routePattern: null });
    const homes = await visit("/homes");
    expect(homes.statusCode).toBe(200);
    expect(homes.body).toContain("Raby Row");
    expect(homes.body).toContain("£865,000");
    expect(homes.body).toContain('src="/_lintel/illustrations/threshold-terrace.svg"');

    // Applied again, the collection is left as it is: no second set of homes.
    const again = await owner("POST", "/starter-sites/threshold/apply", {
      publish: true,
      existingPages: "replace",
    });
    expect(again.json().collectionsMade).toEqual([]);
    const entries = (await owner("GET", "/collections/listings/entries")).json();
    expect(entries.entries ?? entries.items ?? entries).toHaveLength(6);
  });

  it("leaves a template's collections alone for someone who may not change collections", async () => {
    await createTestUser(testDatabase.database, "writer@example.com", [
      ["entries:read", "entries:create", "entries:update", "entries:publish", "builder:design"],
    ]);
    const writer = requestsAs(api, await signInAndGetCookies(api, "writer@example.com"));
    const response = await writer("POST", "/starter-sites/longwave/apply", { publish: true });
    expect(response.statusCode, response.body).toBe(201);
    expect(response.json().collectionsMade).toEqual([]);
    expect((await owner("GET", "/collections/episodes")).statusCode).toBe(404);
  });

  it("gives Longplay's mailing list a working newsletter form while Forms is on", async () => {
    await owner("PUT", "/plugins", { enabled: ["forms"] });
    const response = await owner("POST", "/starter-sites/longplay/apply", { publish: true });
    expect(response.statusCode, response.body).toBe(201);
    const forms = (await owner("GET", "/forms")).json().forms;
    expect(forms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ handle: "newsletter", name: "Newsletter" }),
      ]),
    );
    const page = await visit("/mailing-list");
    expect(page.body).toContain('type="email"');
  });

  it("says plainly when a template doesn't exist", async () => {
    const response = await owner("POST", "/starter-sites/space-station/apply", {});
    expect(response.statusCode).toBe(404);
    expect(response.json().message).toContain("There is no template called");
  });
});

describe("the builder's canvas", () => {
  const testDatabase = useTestDatabase();
  let api: FastifyInstance;
  let site: FastifyInstance;

  beforeEach(async () => {
    api = await startTestServer(testDatabase.activeDatabase, {
      website: { builtInSiteUrl: SITE_URL },
    });
    site = buildSiteServer({ api });
    await site.ready();
    await ensureSiteSettings(testDatabase.database);
    await ensureMainMenu(testDatabase.database);
  });

  afterEach(async () => {
    await site.close();
    await api.close();
  });

  it("draws with exactly the website's stylesheet, header and footer", async () => {
    await createTestUser(testDatabase.database, "writer@example.com", [["entries:read"]]);
    const writer = requestsAs(api, await signInAndGetCookies(api, "writer@example.com"));
    const response = await writer("GET", "/website/canvas");
    expect(response.statusCode, response.body).toBe(200);
    const canvas = response.json();

    const home = await site.inject({ method: "GET", url: "/" });
    const stylesheetPath = /<link rel="stylesheet" href="([^"]+)"/.exec(home.body)?.[1] ?? "";
    const served = await site.inject({ method: "GET", url: stylesheetPath });
    expect(canvas.stylesheet).toBe(served.body);
    expect(canvas.stylesheet).toContain(":where(.lintel-design)");
    expect(home.body).toContain(`<body class="${canvas.bodyClassName}">`);
    expect(canvas.headerHtml).toContain('class="lintel-header');
    expect(canvas.footerHtml).toContain('class="lintel-footer');
    expect(canvas.baseUrl).toBe(SITE_URL);
    expect(canvas.motionScript).toContain("lintelMotion");
  });

  it("is only for people who can read content", async () => {
    await createTestUser(testDatabase.database, "nobody@example.com", [[]]);
    const nobody = requestsAs(api, await signInAndGetCookies(api, "nobody@example.com"));
    expect((await nobody("GET", "/website/canvas")).statusCode).toBe(403);
  });
});
