import { createEmptyPage, type PageDocument } from "@lintel/builder-model";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { acceptAnyAsset } from "../fieldtypes/image-assets.js";
import { ensureSiteSettings } from "../globals/default-globals.js";
import { ensureMainMenu } from "../navigation/default-navigation.js";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { readPageDesign } from "../website/designed-pages.js";
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

  it("save a transition and an intro, which every page then carries", async () => {
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
