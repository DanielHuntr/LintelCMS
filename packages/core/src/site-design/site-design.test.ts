import { createEmptyPage, sharedStylesById } from "@lintel/builder-model";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensurePagesCollection } from "../collections/default-collections.js";
import { acceptAnyAsset } from "../fieldtypes/image-assets.js";
import { ensureSiteSettings } from "../globals/default-globals.js";
import { ensureMainMenu } from "../navigation/default-navigation.js";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { drawPageDesign } from "../website/designed-pages.js";
import { buildSiteServer } from "../website/site-server.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { upsertSettingValue } from "../settings/settings.repository.js";
import { findOrCreateDefaultSite } from "../sites/sites.service.js";
import { starterSiteSections } from "../site-sections/site-sections.service.js";
import { readSiteDesign } from "./site-design.service.js";

describe("the site's design system", () => {
  const testDatabase = useTestDatabase();
  let api: FastifyInstance;
  let site: FastifyInstance;
  let owner: SendRequest;
  let writer: SendRequest;

  beforeEach(async () => {
    api = await startTestServer(testDatabase.activeDatabase, { assetExists: acceptAnyAsset });
    site = buildSiteServer({ api });
    await site.ready();
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

  it("starts empty", async () => {
    const response = await writer("GET", "/website/design");
    expect(response.json()).toEqual({ variables: [], sharedStyles: [], revision: null });
  });

  it("refuses a change made from an older copy, so nobody undoes someone else's", async () => {
    const sand = { id: "sand", name: "Sand", kind: "colour", value: "#efe6d6" };
    const first = await owner("PUT", "/website/design", {
      variables: [sand],
      sharedStyles: [],
      revision: null,
    });
    expect(first.statusCode, first.body).toBe(200);
    const read = first.json().revision as string;
    expect(read).toEqual(expect.any(String));
    expect((await owner("GET", "/website/design")).json().revision).toBe(read);

    // Someone else saves; a copy read before that can't overwrite it.
    await new Promise((resolve) => setTimeout(resolve, 5));
    const other = await owner("PUT", "/website/design", {
      variables: [sand, { ...sand, id: "ink", name: "Ink", value: "#222222" }],
      sharedStyles: [],
      revision: read,
    });
    expect(other.statusCode, other.body).toBe(200);
    const stale = await owner("PUT", "/website/design", {
      variables: [],
      sharedStyles: [],
      revision: read,
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json().code).toBe("SITE_DESIGN_CHANGED");
    expect((await owner("GET", "/website/design")).json().variables).toHaveLength(2);
    // Saving without a revision (as starter templates do) still works.
    expect((await owner("PUT", "/website/design", { variables: [] })).statusCode).toBe(200);
  });

  it("draws every page with the variables and shared styles saved", async () => {
    const saved = await owner("PUT", "/website/design", {
      variables: [{ id: "sand", name: "Sand", kind: "colour", value: "#efe6d6" }],
      sharedStyles: [
        {
          id: "roomy",
          name: "Section – roomy",
          styles: { base: { backgroundColor: "var(--lintel-var-sand)", paddingTop: "7rem" } },
        },
      ],
    });
    expect(saved.statusCode, saved.body).toBe(200);
    await owner("POST", "/starter-sites/bakery/apply", { publish: true });

    const website = await site.inject({ method: "GET", url: "/" });
    const stylesheetPath = /href="(\/_lintel\/site-[^"]+\.css)"/.exec(website.body)?.[1];
    expect(stylesheetPath).toBeDefined();
    const stylesheet = await site.inject({ method: "GET", url: stylesheetPath ?? "" });
    expect(stylesheet.body).toContain(":root {\n  --lintel-var-sand: #efe6d6;\n}");

    // A designed page whose section uses the shared style is drawn with its look.
    const design = createEmptyPage();
    design.root.children = [
      {
        id: "hero",
        type: "section",
        name: "Hero",
        props: {},
        styles: { base: { paddingBottom: "1rem" } },
        children: [],
        hidden: false,
        locked: false,
        sharedStyle: "roomy",
      },
    ];
    const sharedStyles = sharedStylesById(
      await readSiteDesign(
        testDatabase.database,
        await findOrCreateDefaultSite(testDatabase.database),
      ),
    );
    const drawn = drawPageDesign(design, { sharedStyles });
    expect(drawn.css).toContain(
      ".hero {\n  padding-top: 7rem;\n  padding-bottom: 1rem;\n  background-color: var(--lintel-var-sand);\n}",
    );
  });

  it("counts each variable's and shared style's uses across the whole site, page by page", async () => {
    await owner("PUT", "/website/design", {
      variables: [{ id: "sand", name: "Sand", kind: "colour", value: "#efe6d6" }],
      sharedStyles: [{ id: "roomy", name: "Roomy", styles: { base: { paddingTop: "7rem" } } }],
    });
    const node = (id: string, base: Record<string, string>, sharedStyle?: string) => ({
      id,
      type: "section",
      name: id,
      props: {},
      styles: { base },
      children: [],
      hidden: false,
      locked: false,
      ...(sharedStyle ? { sharedStyle } : {}),
    });
    const pageWith = (children: unknown[]) => ({
      ...createEmptyPage(),
      root: { ...createEmptyPage().root, children },
    });
    const sandy = { backgroundColor: "var(--lintel-var-sand)" };
    await ensurePagesCollection(testDatabase.database);
    const create = async (title: string, children: unknown[]) => {
      const created = await owner("POST", "/collections/pages/entries", {
        data: { title, design: pageWith(children) },
      });
      expect(created.statusCode, created.body).toBe(201);
      return created.json().id as string;
    };
    const homeId = await create("Home", [node("a", sandy, "roomy"), node("b", sandy)]);
    await create("About", [node("c", { color: "var(--lintel-var-sand)" }, "roomy")]);
    await create("Contact", [node("d", { paddingTop: "1rem" })]);

    const all = await writer("GET", "/website/design/uses");
    expect(all.statusCode, all.body).toBe(200);
    expect(all.json()).toEqual({
      variables: { sand: { uses: 3, pages: 2 } },
      sharedStyles: { roomy: { uses: 2, pages: 2 } },
    });
    // The page being designed is counted by the builder, so it can be left out.
    expect((await writer("GET", `/website/design/uses?entry=${homeId}`)).json()).toEqual({
      variables: { sand: { uses: 1, pages: 1 } },
      sharedStyles: { roomy: { uses: 1, pages: 1 } },
    });

    // The navigation and footer count as uses, not pages; with a page left out they go too,
    // since the builder shows them on the page.
    const { navigation } = starterSiteSections();
    const sandyNavigation = { ...navigation, styles: { ...navigation?.styles, base: sandy } };
    expect(
      (await owner("PUT", "/website/sections", { navigation: sandyNavigation })).statusCode,
    ).toBe(200);
    expect((await writer("GET", "/website/design/uses")).json().variables).toEqual({
      sand: { uses: 4, pages: 2 },
    });
    expect((await writer("GET", `/website/design/uses?entry=${homeId}`)).json().variables).toEqual({
      sand: { uses: 1, pages: 1 },
    });
  });

  it("gives a colour its dark-mode value on the website, following the theme's scheme", async () => {
    const saved = await owner("PUT", "/website/design", {
      variables: [
        { id: "paper", name: "Paper", kind: "colour", value: "#faf7f2", darkValue: "#16181d" },
      ],
    });
    expect(saved.statusCode, saved.body).toBe(200);
    await owner("POST", "/starter-sites/bakery/apply", { publish: true });
    const website = await site.inject({ method: "GET", url: "/" });
    const stylesheetPath = /href="(\/_lintel\/site-[^"]+\.css)"/.exec(website.body)?.[1];
    const stylesheet = await site.inject({ method: "GET", url: stylesheetPath ?? "" });
    expect(stylesheet.body).toContain("--lintel-var-paper: light-dark(#faf7f2, #16181d);");
    // The theme sets the scheme light-dark() follows.
    expect(stylesheet.body).toMatch(/color-scheme: (light dark|light|dark);/);
  });

  it("draws the site's looks for every heading and every button", async () => {
    const saved = await owner("PUT", "/website/design", {
      tagStyles: {
        headings: { base: { letterSpacing: "-0.03em" } },
        buttons: { base: { borderRadius: "999px" } },
      },
    });
    expect(saved.statusCode, saved.body).toBe(200);
    await owner("POST", "/starter-sites/bakery/apply", { publish: true });
    const website = await site.inject({ method: "GET", url: "/" });
    const stylesheetPath = /href="(\/_lintel\/site-[^"]+\.css)"/.exec(website.body)?.[1];
    const stylesheet = await site.inject({ method: "GET", url: stylesheetPath ?? "" });
    expect(stylesheet.body).toContain(
      ":where(.lintel-design) :is(h1, h2, h3, h4, h5, h6) {\n  letter-spacing: -0.03em;\n}",
    );

    const design = createEmptyPage();
    design.root.children = [
      {
        id: "call",
        type: "button",
        name: "Call",
        props: { label: "Call", href: "" },
        styles: { base: { borderRadius: "var(--lintel-radius-button)", color: "red" } },
        children: [],
        hidden: false,
        locked: false,
      },
    ];
    const drawn = drawPageDesign(design, {
      tagStyles: (
        await readSiteDesign(
          testDatabase.database,
          await findOrCreateDefaultSite(testDatabase.database),
        )
      ).tagStyles,
    });
    expect(drawn.css).toContain("border-radius: 999px;");
    expect(drawn.css).toContain("color: red;");
  });

  it("refuses values that could break the stylesheet, and people who can't change blocks", async () => {
    const unsafe = await owner("PUT", "/website/design", {
      variables: [{ id: "sand", name: "Sand", kind: "colour", value: "#fff; } body { x: y" }],
    });
    expect(unsafe.statusCode).toBe(400);
    const refused = await writer("PUT", "/website/design", { variables: [], sharedStyles: [] });
    expect(refused.statusCode).toBe(403);
  });
  describe("with several sites", () => {
    const sand = { id: "sand", name: "Sand", kind: "colour", value: "#efe6d6" };
    const slate = { id: "slate", name: "Slate", kind: "colour", value: "#3b4252" };

    beforeEach(async () => {
      const created = await owner("POST", "/sites", {
        handle: "france",
        name: "Acme France",
        hostnames: ["acme.fr"],
        defaultLocale: "fr-FR",
      });
      expect(created.statusCode, created.body).toBe(201);
    });

    /** The stylesheet a site's home page links to, visited at the site's own domain. */
    async function stylesheetOf(host?: string): Promise<string> {
      const headers = host ? { host } : undefined;
      const home = await site.inject({ method: "GET", url: "/", headers });
      const path = /href="(\/_lintel\/site-[^"]+\.css)"/.exec(home.body)?.[1];
      expect(path, home.body.slice(0, 500)).toBeDefined();
      return (await site.inject({ method: "GET", url: path ?? "", headers })).body;
    }

    it("keeps each site's variables to itself, on the website too", async () => {
      await owner("PUT", "/website/design", { variables: [sand], sharedStyles: [] });
      const france = await owner("PUT", "/website/design?site=france", {
        variables: [slate],
        sharedStyles: [],
      });
      expect(france.statusCode, france.body).toBe(200);

      expect((await owner("GET", "/website/design")).json().variables).toEqual([sand]);
      expect((await owner("GET", "/website/design?site=france")).json().variables).toEqual([slate]);

      await owner("POST", "/starter-sites/bakery/apply", { publish: true });
      await owner("POST", "/starter-sites/bakery/apply?site=france", { publish: true });
      const main = await stylesheetOf();
      const french = await stylesheetOf("acme.fr");
      expect(main).toContain("--lintel-var-sand: #efe6d6;");
      expect(main).not.toContain("--lintel-var-slate");
      expect(french).toContain("--lintel-var-slate: #3b4252;");
      expect(french).not.toContain("--lintel-var-sand");
    });

    it("shows every site the design saved before sites had their own, until it changes", async () => {
      await upsertSettingValue(testDatabase.database, DEFAULT_TENANT_ID, "siteDesign", {
        variables: [sand],
        sharedStyles: [],
      });
      expect((await owner("GET", "/website/design")).json().variables).toEqual([sand]);
      expect((await owner("GET", "/website/design?site=france")).json().variables).toEqual([sand]);

      await owner("PUT", "/website/design?site=france", { variables: [slate], sharedStyles: [] });
      expect((await owner("GET", "/website/design")).json().variables).toEqual([sand]);
      expect((await owner("GET", "/website/design?site=france")).json().variables).toEqual([slate]);
    });

    it("needs the same permissions as before, and the site", async () => {
      const refused = await writer("PUT", "/website/design?site=france", {
        variables: [slate],
        sharedStyles: [],
      });
      expect(refused.statusCode).toBe(403);
      await owner("PUT", "/sites/access/owner@example.com-role-0", { siteHandles: ["france"] });
      const limited = requestsAs(api, await signInAndGetCookies(api, "owner@example.com"));
      expect((await limited("GET", "/website/design")).statusCode).toBe(403);
      expect((await limited("GET", "/website/design?site=france")).statusCode).toBe(200);
    });
  });
});
