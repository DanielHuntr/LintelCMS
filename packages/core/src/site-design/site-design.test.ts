import { createEmptyPage, sharedStylesById } from "@lintel/builder-model";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { acceptAnyAsset } from "../fieldtypes/image-assets.js";
import { ensureSiteSettings } from "../globals/default-globals.js";
import { ensureMainMenu } from "../navigation/default-navigation.js";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { drawPageDesign } from "../website/designed-pages.js";
import { buildSiteServer } from "../website/site-server.js";
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
    expect(response.json()).toEqual({ variables: [], sharedStyles: [] });
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
    const sharedStyles = sharedStylesById(await readSiteDesign(testDatabase.database));
    const drawn = drawPageDesign(design, { sharedStyles });
    expect(drawn.css).toContain(
      ".hero {\n  padding-top: 7rem;\n  padding-bottom: 1rem;\n  background-color: var(--lintel-var-sand);\n}",
    );
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
      tagStyles: (await readSiteDesign(testDatabase.database)).tagStyles,
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
});
