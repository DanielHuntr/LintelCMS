import { createEmptyPage, type PageDocument } from "@lintel/builder-model";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { acceptAnyAsset } from "../fieldtypes/image-assets.js";
import { ensureSiteSettings } from "../globals/default-globals.js";
import { ensureMainMenu } from "../navigation/default-navigation.js";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { defaultSiteEffectSettings } from "@lintel/motion/effects";
import { readPageDesign } from "../website/designed-pages.js";
import { isHomePage, siteEffectsHead } from "./site-effects.service.js";
import { readEffectModules } from "../website/site-assets.js";
import { buildSiteServer } from "../website/site-server.js";

function designWithEffects(): PageDocument {
  const page = createEmptyPage();
  const node = (id: string, type: string, effects: PageDocument["root"]["effects"]) => ({
    id,
    type,
    name: "",
    props: type === "heading" ? { text: "Hello there", level: 2 } : {},
    styles: { base: {} },
    children: [],
    hidden: false,
    locked: false,
    effects,
  });
  return {
    ...page,
    root: {
      ...page.root,
      children: [
        node("title", "heading", [{ effect: "scramble-in", params: { duration: 600 } }]),
        node("hero", "section", [
          { effect: "liquid-ocean", params: {} },
          { effect: "no-longer-exists", params: {} },
        ]),
      ],
    },
  };
}

describe("effects on designed pages", () => {
  it("lists what the effects runtime mounts, marks the elements and writes static fallbacks", () => {
    const design = readPageDesign(designWithEffects(), "removeScripts");
    expect(design?.effects).toEqual([
      {
        nodeId: "title",
        module: "text",
        behaviour: "scramble",
        params: { duration: 600, trigger: "view" },
      },
      expect.objectContaining({
        nodeId: "hero",
        module: "liquid-gradient",
        behaviour: "liquidGradient",
      }),
    ]);
    expect(design?.html).toContain('data-node-id="title"');
    expect(design?.css).toContain('[data-node-id="hero"] { background: radial-gradient');
  });
});

describe("code blocks that use the motion runtime", () => {
  it("make the page load it, even without effects of its own", () => {
    const page = createEmptyPage();
    const block = (js: string) => ({
      ...page,
      root: {
        ...page.root,
        children: [
          {
            id: "code",
            type: "codeBlock",
            name: "",
            props: { html: "<p>Hi</p>", css: "", js },
            styles: { base: {} },
            children: [],
            hidden: false,
            locked: false,
          },
        ],
      },
    });
    expect(
      readPageDesign(
        block("window.lintelMotion.registerEffectBehaviour('glow', () => {})"),
        "allowScripts",
      )?.usesMotionApi,
    ).toBe(true);
    expect(readPageDesign(block("console.log('hello')"), "allowScripts")?.usesMotionApi).toBe(
      false,
    );
  });
});

describe("site-wide effects for one page", () => {
  const chrome = { homeUrl: "/", siteName: "Rye & Crumb", logo: null };
  const introAndTransition = {
    ...defaultSiteEffectSettings,
    pageTransition: { style: "fade" as const, duration: 300 },
    intro: { ...defaultSiteEffectSettings.intro, style: "logo" as const },
  };

  it("knows the home page in any language, with or without a trailing slash", () => {
    expect(isHomePage({ path: "/", chrome })).toBe(true);
    expect(isHomePage({ path: "/fr/", chrome: { ...chrome, homeUrl: "/fr" } })).toBe(true);
    expect(isHomePage({ path: "/about", chrome })).toBe(false);
  });

  it("give nothing at all when everything is off", () => {
    expect(siteEffectsHead(defaultSiteEffectSettings, { path: "/", chrome })).toBeUndefined();
  });

  it("draw the intro on the home page only, with the site's name when there's no logo", () => {
    const home = siteEffectsHead(introAndTransition, { path: "/", chrome });
    expect(home?.bodyStartHtml).toContain("Rye &amp; Crumb");
    expect(home?.modules).toEqual(["transitions", "intro"]);
    expect(home?.headScript).toContain("lintel-intro-seen");

    const about = siteEffectsHead(introAndTransition, { path: "/about", chrome });
    expect(about?.bodyStartHtml).toBe("");
    expect(about?.modules).toEqual(["transitions"]);
    expect(about?.headScript).not.toContain("lintel-intro-seen");
    expect(about?.css).not.toContain(".lintel-intro");
  });

  it("use the logo when the site has one", () => {
    const head = siteEffectsHead(introAndTransition, {
      path: "/",
      chrome: {
        ...chrome,
        logo: { url: "/media/logo.png", alt: "Rye", width: 200, height: 80, focalPoint: null },
      },
    });
    expect(head?.bodyStartHtml).toContain('src="/media/logo.png"');
  });

  it("write the cursor word's look as CSS, even without a custom cursor", () => {
    const head = siteEffectsHead(
      {
        ...defaultSiteEffectSettings,
        cursor: {
          ...defaultSiteEffectSettings.cursor,
          word: { ...defaultSiteEffectSettings.cursor.word, shape: "circle" },
        },
      },
      { path: "/about", chrome },
    );
    expect(head?.css).toContain("--lintel-cursor-word-radius:50%");
    expect(head?.modules).toEqual([]);
  });

  it("load the cursor picture at the size it's shown, and only once there is one", () => {
    const withPicture = (src: string) => ({
      ...defaultSiteEffectSettings,
      cursor: {
        ...defaultSiteEffectSettings.cursor,
        style: "picture" as const,
        picture: { assetId: "a1", src, size: 40, point: "top-left" as const, bytes: 900 },
      },
    });
    const head = siteEffectsHead(withPicture("https://cms.test/api/media/a1/file?v=3"), {
      path: "/",
      chrome,
    });
    expect(head?.modules).toEqual(["cursor"]);
    expect(head?.settings).toMatchObject({
      cursor: { picture: { src: "https://cms.test/api/media/a1/file?v=3&w=80&format=png" } },
    });
    expect(siteEffectsHead(withPicture(""), { path: "/", chrome })).toBeUndefined();
  });

  it("send the intro alone on the home page, and nothing on others", () => {
    const introOnly = {
      ...introAndTransition,
      pageTransition: { style: "none" as const, duration: 500 },
    };
    expect(siteEffectsHead(introOnly, { path: "/about", chrome })).toBeUndefined();
    expect(siteEffectsHead(introOnly, { path: "/", chrome })?.headScript).not.toContain("pageswap");
  });
});

describe("site-wide effects", () => {
  const testDatabase = useTestDatabase();
  let api: FastifyInstance;
  let site: FastifyInstance;
  let owner: SendRequest;

  beforeEach(async () => {
    api = await startTestServer(testDatabase.activeDatabase, { assetExists: acceptAnyAsset });
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

  it("start switched off, and pages then carry no effect code", async () => {
    const settings = await owner("GET", "/website/effects");
    expect(settings.json()).toMatchObject({
      pageTransition: { style: "none" },
      cursor: { style: "none" },
      intro: { style: "none" },
    });
    await owner("POST", "/starter-sites/bakery/apply", { publish: true });
    const home = await site.inject({ method: "GET", url: "/" });
    expect(home.body).not.toContain("lintel-effects");
    expect(home.body).not.toContain("@view-transition");
  });

  it("save a transition for every page and an intro shown only before the home page", async () => {
    const saved = await owner("PUT", "/website/effects", {
      pageTransition: { style: "slide", duration: 400 },
      intro: { style: "name", text: "Corner Bakery", background: "#222222", colour: "#ffffff" },
    });
    expect(saved.statusCode, saved.body).toBe(200);
    expect(saved.json()).toMatchObject({
      pageTransition: { style: "slide" },
      cursor: { style: "none" },
    });
    await owner("POST", "/starter-sites/bakery/apply", { publish: true });
    const home = await site.inject({ method: "GET", url: "/" });
    expect(home.body).toContain("@view-transition { navigation: auto; }");
    expect(home.body).toContain('<div class="lintel-intro" data-style="name"');
    expect(home.body).toContain("Skip intro");
    const data = /<script type="application\/json" id="lintel-effects">(.*?)<\/script>/.exec(
      home.body,
    );
    const effects = JSON.parse(data?.[1] ?? "{}");
    expect(Object.keys(effects.modules).sort()).toEqual(["intro", "transitions"]);
    expect(effects.site.intro.text).toBe("Corner Bakery");

    const otherPath = /<a [^>]*href="(\/[a-z][a-z0-9-]*)"/.exec(home.body)?.[1];
    expect(otherPath, "the bakery's menu links to another page").toBeDefined();
    const other = await site.inject({ method: "GET", url: otherPath! });
    expect(other.statusCode).toBe(200);
    expect(other.body).toContain("@view-transition { navigation: auto; }");
    expect(other.body).not.toContain('class="lintel-intro"');
    expect(other.body).toContain("pageswap");
  });

  it("save smooth scrolling on its own, keeping the cursor, and pages then load its module", async () => {
    await owner("PUT", "/website/effects", {
      cursor: { style: "ring", trail: "none", colour: "brand", size: 32 },
    });
    const saved = await owner("PUT", "/website/effects", { smoothScroll: { strength: "gentle" } });
    expect(saved.statusCode, saved.body).toBe(200);
    expect(saved.json()).toMatchObject({
      smoothScroll: { strength: "gentle" },
      cursor: { style: "ring", colour: "brand" },
    });
    await owner("POST", "/starter-sites/bakery/apply", { publish: true });
    const home = await site.inject({ method: "GET", url: "/" });
    const data = /<script type="application\/json" id="lintel-effects">(.*?)<\/script>/.exec(
      home.body,
    );
    const effects = JSON.parse(data?.[1] ?? "{}");
    expect(Object.keys(effects.modules).sort()).toEqual(["cursor", "smooth-scroll"]);
    expect(effects.site.smoothScroll.strength).toBe("gentle");
  });

  it("refuses settings that aren't on offer", async () => {
    const response = await owner("PUT", "/website/effects", { cursor: { style: "sparkly" } });
    expect(response.statusCode).toBe(400);
  });

  it("serves the effect modules to any address, and nothing else from their folder", async () => {
    const modules = readEffectModules();
    expect(modules, "build @lintel/motion first").not.toBeNull();
    const response = await site.inject({ method: "GET", url: modules!.urls.pointer! });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/javascript");
    expect(response.headers["access-control-allow-origin"]).toBe("*");
    expect(response.body).toContain("magnetic");
    const missing = await site.inject({ method: "GET", url: "/_lintel/effects/manifest.json" });
    expect(missing.statusCode).toBe(404);
  });
});
