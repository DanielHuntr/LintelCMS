import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  type NodeBlueprint,
  type PageDocument,
  standardCatalogue,
} from "@lintel/builder-model";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pagesWithSimpleSectionsCollection } from "../collections/default-collections.js";
import { ensureCollection } from "../collections/collections.service.js";
import { acceptAnyAsset } from "../fieldtypes/image-assets.js";
import { ensureSiteSettings } from "../globals/default-globals.js";
import { ensureMainMenu } from "../navigation/default-navigation.js";
import { insertSiteFontRow } from "../site-fonts/site-fonts.repository.js";
import { findOrCreateDefaultSite } from "../sites/sites.service.js";
import { useTestDatabase } from "../testing/test-database.js";
import { createHomePage } from "../testing/test-home-page.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { buildSiteServer } from "../website/site-server.js";
import { websiteFontsStylesheet } from "../site-fonts/website-fonts.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { cookieNoticeMessage, findSiteConsentServices } from "./cookie-notice.service.js";
import {
  listPluginConsentServices,
  registerPluginConsentServices,
} from "./plugin-consent-services.js";

function design(...blueprints: NodeBlueprint[]): PageDocument {
  const createId = createCountingNodeIds("d");
  const page = createEmptyPage();
  const section = createNode(
    { type: "section", children: blueprints },
    standardCatalogue,
    createId,
  );
  return { ...page, root: { ...page.root, children: [section] } };
}

const youTubeVideo: NodeBlueprint = {
  type: "video",
  props: {
    source: "youtube",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    title: "Our bakery",
  },
};
const map: NodeBlueprint = {
  type: "map",
  props: { placeName: "The bakery", latitude: 51.5, longitude: -0.12, zoom: 15 },
};

/** What a page tells the cookie notice's script, or null when it has no notice. */
function noticeSettings(html: string): Record<string, unknown> | null {
  const json = /<script type="application\/json" id="lintel-cookie-notice">(.*?)<\/script>/s.exec(
    html,
  )?.[1];
  return json ? (JSON.parse(json) as Record<string, unknown>) : null;
}

describe("the cookie notice", { timeout: 30000 }, () => {
  const testDatabase = useTestDatabase();
  let api: FastifyInstance;
  let site: FastifyInstance;
  let admin: SendRequest;

  beforeEach(async () => {
    api = await startTestServer(testDatabase.activeDatabase, { assetExists: acceptAnyAsset });
    site = buildSiteServer({ api });
    await site.ready();
    await ensureCollection(testDatabase.database, pagesWithSimpleSectionsCollection);
    await ensureSiteSettings(testDatabase.database);
    await ensureMainMenu(testDatabase.database);
    await createTestUser(testDatabase.database, "owner@example.com", [["*"]]);
    admin = requestsAs(api, await signInAndGetCookies(api, "owner@example.com"));
    await createHomePage(admin);
  }, 30000);

  afterEach(async () => {
    await site.close();
    await api.close();
  });

  const visit = async (url: string) => (await site.inject({ method: "GET", url })).body;

  async function publish(data: Record<string, unknown>, slug: string) {
    const created = await admin("POST", "/collections/pages/entries", { data, slug });
    expect(created.statusCode, created.body).toBe(201);
    const published = await admin("POST", `/entries/${created.json().id}/publish`);
    expect(published.statusCode, published.body).toBe(200);
    return created.json() as { id: string };
  }

  it("shows nothing on a site that uses nothing that may set cookies", async () => {
    await publish(
      { title: "About", design: design({ type: "heading", props: { text: "Hi" } }) },
      "about",
    );

    const html = await visit("/about");
    expect(noticeSettings(html)).toBeNull();
    expect(html).not.toContain("cookie-notice-");
    expect(html).not.toContain("Cookie settings");
    const described = await admin("GET", "/website/cookie-notice");
    expect(described.json()).toMatchObject({
      settings: { mode: "automatic", position: "bar" },
      services: [],
      shown: false,
    });
  });

  it("is on by itself once a page has a YouTube video and a map, naming both", async () => {
    await publish({ title: "Visit", design: design(youTubeVideo, map) }, "visit");

    const html = await visit("/visit");
    const settings = noticeSettings(html);
    expect(settings).toMatchObject({
      services: [
        { id: "openstreetmap", name: "OpenStreetMap" },
        { id: "youtube", name: "YouTube" },
      ],
      version: "openstreetmap youtube",
      position: "bar",
      heading: "Cookies",
      privacyUrl: null,
    });
    expect(settings?.message).toContain("This site uses OpenStreetMap and YouTube");
    expect(String(settings?.storageKey)).toMatch(/^lintel-consent:/);
    expect(html).toMatch(/<script src="\/_lintel\/cookie-notice-[0-9a-f]{12}\.js" defer/);
    // The embeds wait, marked with the service a choice allows.
    expect(html).toContain('data-consent-service="youtube"');
    expect(html).toContain('data-consent-service="openstreetmap"');
    expect(html).not.toContain("<iframe");
    // Every page of the site has it, with a way back in the footer.
    const home = await visit("/");
    expect(noticeSettings(home)).not.toBeNull();
    expect(home).toContain("data-lintel-cookie-settings");
    expect(home).toContain("Cookie settings");

    const script = await site.inject({
      method: "GET",
      url: /src="(\/_lintel\/cookie-notice-[^"]+)"/.exec(html)?.[1] ?? "",
    });
    expect(script.statusCode).toBe(200);
    expect(script.headers["content-type"]).toContain("javascript");

    const described = await admin("GET", "/website/cookie-notice");
    expect(described.json()).toMatchObject({
      services: [{ name: "OpenStreetMap" }, { name: "YouTube" }],
      shown: true,
    });
  });

  it("follows Off, Always, the position, the words and the privacy page", async () => {
    await publish({ title: "Visit", design: design(map) }, "visit");
    const privacy = await publish({ title: "Privacy" }, "privacy");

    const saved = await admin("PUT", "/website/cookie-notice", {
      position: "corner",
      heading: "Before you look around",
      message: "We show maps from {services}.",
      privacyPageId: privacy.id,
    });
    expect(saved.statusCode, saved.body).toBe(200);
    expect(saved.json().settings).toMatchObject({ mode: "automatic", position: "corner" });
    expect(noticeSettings(await visit("/visit"))).toMatchObject({
      position: "corner",
      heading: "Before you look around",
      message: "We show maps from OpenStreetMap.",
      privacyUrl: "/privacy",
    });

    await admin("PUT", "/website/cookie-notice", { mode: "off" });
    const off = await visit("/visit");
    expect(noticeSettings(off)).toBeNull();
    expect(off).not.toContain("Cookie settings");
    // The rest stayed as they were.
    expect((await admin("GET", "/website/cookie-notice")).json().settings).toMatchObject({
      mode: "off",
      position: "corner",
      heading: "Before you look around",
    });

    expect((await admin("PUT", "/website/cookie-notice", { mode: "sometimes" })).statusCode).toBe(
      400,
    );
  });

  it("shows on Always even when nothing is found", async () => {
    await admin("PUT", "/website/cookie-notice", { mode: "always" });
    const settings = noticeSettings(await visit("/"));
    expect(settings).toMatchObject({ services: [], version: "" });
    expect(settings?.message).toContain("may use services from other companies");
  });

  it("waits for visitors to allow Adobe Fonts before linking its stylesheet", async () => {
    const defaultSite = await findOrCreateDefaultSite(testDatabase.database);
    await insertSiteFontRow(testDatabase.database, {
      tenantId: DEFAULT_TENANT_ID,
      siteId: defaultSite.id,
      family: "proxima-nova",
      category: "sans",
      source: "adobe",
      sourceId: "abc1def",
    });

    const html = await visit("/");
    expect(html).not.toContain('<link rel="stylesheet" href="https://use.typekit.net');
    expect(noticeSettings(html)).toMatchObject({
      services: [{ id: "adobe-fonts", name: "Adobe Fonts" }],
      fontStylesheets: ["https://use.typekit.net/abc1def.css"],
    });

    // With the notice off, the stylesheet is linked as before.
    await admin("PUT", "/website/cookie-notice", { mode: "off" });
    expect(await visit("/")).toContain(
      '<link rel="stylesheet" href="https://use.typekit.net/abc1def.css"',
    );
  });

  it("finds services in the site's footer and blocks, and those of plugins that are on", async () => {
    const defaultSite = await findOrCreateDefaultSite(testDatabase.database);
    const footer = createNode(
      {
        type: "section",
        props: { element: "footer" },
        children: [{ type: "embed", props: { url: "https://calendly.com/bakery", title: "Book" } }],
      },
      standardCatalogue,
      createCountingNodeIds("f"),
    );
    const saved = await admin("PUT", "/website/sections", { footer });
    expect(saved.statusCode, saved.body).toBe(200);
    // Changes to the shared sections wait for Publish; the notice reads the live ones.
    const published = await admin("POST", "/website/sections/publish");
    expect(published.statusCode, published.body).toBe(200);
    registerPluginConsentServices("chat-window", [{ handle: "chat", name: "Chatterbox" }]);

    const services = await findSiteConsentServices(testDatabase.database, defaultSite, {
      scriptRule: "removeScripts",
      usesAdobeFonts: false,
      enabledPlugins: ["chat-window"],
    });
    expect(services).toEqual([
      { id: "embed:calendly.com", name: "Calendly" },
      { id: "plugin:chat-window:chat", name: "Chatterbox" },
    ]);
    registerPluginConsentServices("chat-window", []);
    expect(listPluginConsentServices(["chat-window"])).toEqual([]);
  });
});

describe("the notice's words", () => {
  it("names one service, several, or none", () => {
    expect(cookieNoticeMessage({ message: "" }, [{ id: "youtube", name: "YouTube" }])).toBe(
      "This site uses YouTube, which may set cookies. Nothing from it loads until you say so.",
    );
    expect(
      cookieNoticeMessage({ message: "" }, [
        { id: "adobe-fonts", name: "Adobe Fonts" },
        { id: "vimeo", name: "Vimeo" },
        { id: "youtube", name: "YouTube" },
      ]),
    ).toContain("Adobe Fonts, Vimeo and YouTube, which may set cookies. Nothing from them");
    expect(cookieNoticeMessage({ message: "Our own words." }, [])).toBe("Our own words.");
  });

  it("says visit counting sets no cookies, apart from the services that may", () => {
    const counts = { id: "plugin:analytics", name: "Visitor counts", countsWithoutCookies: true };
    expect(cookieNoticeMessage({ message: "" }, [counts])).toBe(
      "This site counts visits without cookies. Nothing is counted until you say so.",
    );
    expect(
      cookieNoticeMessage({ message: "" }, [
        { id: "youtube", name: "YouTube" },
        { id: "embed:google.com", name: "Google Maps" },
        counts,
      ]),
    ).toBe(
      "This site uses YouTube and Google Maps, which may set cookies, and counts visits without cookies. Nothing from them loads, and nothing is counted, until you say so.",
    );
  });
});

describe("Adobe Fonts while visitors haven't allowed them", () => {
  it("fall back to the theme's own fonts", () => {
    const css = websiteFontsStylesheet(
      [{ family: "proxima-nova", category: "sans", source: "adobe", faces: [] }],
      { headingFont: "proxima-nova", bodyFont: null, theme: { fontPairing: "classic" } },
    );
    expect(css).toMatch(/--lintel-font-heading: 'proxima-nova', (?!sans-serif;)/);
  });
});
