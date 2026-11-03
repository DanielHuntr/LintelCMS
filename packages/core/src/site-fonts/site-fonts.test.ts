import { readFile, mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensurePagesCollection } from "../collections/default-collections.js";
import { LocalDiskStorage } from "../media/local-disk-storage.js";
import { uploadAsset } from "../media/index.js";
import { buildServer } from "../server.js";
import { useTestDatabase } from "../testing/test-database.js";
import { createHomePage } from "../testing/test-home-page.js";
import { requestsAs, type SendRequest } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { buildSiteServer } from "../website/site-server.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { findOrCreateDefaultSite } from "../sites/sites.service.js";
import type { FetchFunction } from "./font-network.js";
import { SiteFontNameTakenError } from "./site-fonts.errors.js";
import { MAX_FONTS_PER_SITE } from "./site-fonts.schema.js";
import { insertNewSiteFont } from "./site-fonts.service.js";
import type { GoogleFontsClient } from "./google-fonts-client.js";
import { addGoogleFont } from "./google-fonts.service.js";

/** Adding Lora's regular weight, as the Google Fonts tab asks. */
const request = () => ({ id: "lora", weights: ["400"], italic: false });

const fontFile = (name: string) =>
  readFile(createRequire(import.meta.url).resolve(`@lintel/builder-model/fonts/${name}`));

const adobeCss = `/* The Typekit service used to deliver this font is provided by Adobe. */
@import url("https://p.typekit.net/p.css?s=1&k=abc1def");
@font-face {
font-family:"proxima-nova";
src:url("https://use.typekit.net/af/1/l?fvd=n4&v=3") format("woff2");
font-display:auto;font-style:normal;font-weight:400;font-stretch:normal;
}
@font-face {
font-family:"proxima-nova";
src:url("https://use.typekit.net/af/2/l?fvd=i7&v=3") format("woff2");
font-display:auto;font-style:italic;font-weight:700;font-stretch:normal;
}
@font-face {
font-family:"freight-text-pro";
src:url("https://use.typekit.net/af/3/l?fvd=n4&v=3") format("woff2");
font-style:normal;font-weight:400;
}
.tk-proxima-nova { font-family: "proxima-nova",sans-serif; }
.tk-freight-text-pro { font-family: "freight-text-pro",serif; }
`;

/**
 * Stands in for Fontsource, jsDelivr and Adobe: answers the few addresses the tests use, and
 * records every address asked for. "offline" fails every request as a dropped network would.
 */
class StandInFontServices {
  readonly asked: string[] = [];
  offline = false;
  /** Italic files fail, as a connection dropped part of the way through would. */
  italicsFail = false;
  private woff2 = Buffer.alloc(0);

  async load() {
    this.woff2 = await fontFile("lora-latin-400-normal.woff2");
  }

  fetch: FetchFunction = async (url) => {
    this.asked.push(url);
    if (this.offline) throw new TypeError("fetch failed");
    if (this.italicsFail && url.endsWith("-italic.woff2")) throw new TypeError("fetch failed");
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
    const lora = {
      id: "lora",
      family: "Lora",
      category: "serif",
      weights: [400, 500, 700],
      styles: ["italic", "normal"],
      subsets: ["cyrillic", "latin", "latin-ext"],
      defSubset: "latin",
      type: "google",
    };
    if (url === "https://api.fontsource.org/v1/fonts") {
      return json([
        { ...lora, id: "abel", family: "Abel", category: "sans-serif", styles: ["normal"] },
        lora,
        { ...lora, id: "not-google", family: "Lorabella", type: "other" },
      ]);
    }
    if (url === "https://api.fontsource.org/v1/fonts/lora") {
      return json({
        ...lora,
        unicodeRange: { latin: "U+0000-00FF, U+0131", "latin-ext": "U+0100-02BA" },
      });
    }
    if (
      /^https:\/\/cdn\.jsdelivr\.net\/fontsource\/fonts\/lora@latest\/latin(-ext)?-[47]00-(normal|italic)\.woff2$/.test(
        url,
      )
    ) {
      return new Response(this.woff2, { headers: { "content-type": "font/woff2" } });
    }
    if (url === "https://use.typekit.net/abc1def.css") {
      return new Response(adobeCss, { headers: { "content-type": "text/css" } });
    }
    if (url === "https://use.typekit.net/empty12.css") return new Response("/* nothing */");
    return new Response("Not found", { status: 404 });
  };
}

describe("site fonts", () => {
  const testDatabase = useTestDatabase();
  const services = new StandInFontServices();
  let folder = "";
  let server: FastifyInstance;
  let website: FastifyInstance;
  let api: SendRequest;
  let homeId = "";
  let ownerId = "";

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "lintel-site-fonts-"));
    await services.load();
    services.asked.length = 0;
    services.offline = false;
    services.italicsFail = false;
    server = buildServer({
      adminOrigin: "http://localhost:5173",
      database: testDatabase.activeDatabase,
      runScheduledJobs: false,
      publicApiUrl: "http://api.test",
      media: {
        storage: new LocalDiskStorage(join(folder, "uploads")),
        transformCacheFolder: join(folder, "cache"),
      },
      siteFonts: { fetch: services.fetch },
    });
    await server.ready();
    website = buildSiteServer({ api: server });
    await website.ready();
    await ensurePagesCollection(testDatabase.database);
    ownerId = (await createTestUser(testDatabase.database, "owner@example.com", [["*"]])).id;
    api = requestsAs(server, await signInAndGetCookies(server, "owner@example.com"));
    homeId = await createHomePage(api);
    await api("POST", `/entries/${homeId}/publish`);
  });

  afterEach(async () => {
    await website.close();
    await server.close();
    await rm(folder, { recursive: true, force: true });
  });

  async function upload(name: string, contents: Buffer) {
    const { asset } = await uploadAsset(
      server.siteFonts.context().media,
      { filename: name, contents },
      null,
    );
    return asset;
  }

  /** The home page and the stylesheet it links to. */
  async function visitHome() {
    const page = await website.inject({ method: "GET", url: "/" });
    const stylesheetPath = /href="(\/_lintel\/site-[0-9a-f]+\.css)"/.exec(page.body)?.[1] ?? "";
    const stylesheet = await website.inject({ method: "GET", url: stylesheetPath });
    return { html: page.body, css: stylesheet.body };
  }

  describe("your own fonts", () => {
    it("reads each file's family, weight and style, or guesses from its name", async () => {
      const bold = await upload("whatever.woff2", await fontFile("inter-latin-700-normal.woff2"));
      const italic = await upload("x.woff2", await fontFile("lora-latin-400-italic.woff2"));

      const response = await api("POST", "/site-fonts/inspect", { assetIds: [bold.id, italic.id] });

      expect(response.statusCode, response.body).toBe(200);
      expect(response.json().files).toEqual([
        expect.objectContaining({
          family: "Inter",
          weight: "700",
          style: "normal",
          readFromFile: true,
        }),
        expect.objectContaining({
          family: "Lora",
          weight: "400",
          style: "italic",
          readFromFile: true,
        }),
      ]);
    });

    it("refuses a file that isn't a font", async () => {
      const notAFont = await upload("notes.pdf", Buffer.from("%PDF-1.4\n%%EOF\n"));
      const response = await api("POST", "/site-fonts/inspect", { assetIds: [notAFont.id] });
      expect(response.statusCode).toBe(422);
      expect(response.json().message).toContain("isn't a font file");
    });

    it("needs the maker to confirm their licence, then serves the font on every page", async () => {
      const regular = await upload(
        "StudioSans-Regular.woff2",
        await fontFile("inter-latin-400-normal.woff2"),
      );
      const bold = await upload(
        "StudioSans-Bold.woff2",
        await fontFile("inter-latin-700-normal.woff2"),
      );
      const request = {
        family: "Studio Sans",
        category: "sans",
        files: [
          { assetId: regular.id, weight: "400", style: "normal" },
          { assetId: bold.id, weight: "700", style: "normal" },
        ],
      };

      const unconfirmed = await api("POST", "/site-fonts/uploaded", request);
      expect(unconfirmed.statusCode).toBe(400);
      expect(unconfirmed.json().message).toContain("licence");

      const added = await api("POST", "/site-fonts/uploaded", {
        ...request,
        licenceConfirmed: true,
      });
      expect(added.statusCode, added.body).toBe(201);
      expect(added.json()).toMatchObject({
        family: "Studio Sans",
        source: "upload",
        weights: ["400", "700"],
      });

      const { css } = await visitHome();
      expect(css).toContain("font-family: 'Studio Sans';");
      expect(css).toContain(`url("http://api.test/media/${bold.id}/file?v=`);
      // The included fonts are declared for every page too.
      expect(css).toContain("font-family: 'Bebas Neue';");
    });

    it("won't give two fonts on a site the same name", async () => {
      await api("POST", "/site-fonts/google", { id: "lora", weights: ["400"] });
      const file = await upload("Lora.woff2", await fontFile("inter-latin-400-normal.woff2"));
      const response = await api("POST", "/site-fonts/uploaded", {
        family: "lora",
        files: [{ assetId: file.id }],
        licenceConfirmed: true,
      });
      expect(response.statusCode).toBe(409);
    });
  });

  describe("Google Fonts", () => {
    it("searches the library from the server, leaving out families from elsewhere", async () => {
      const all = await api("GET", "/site-fonts/google");
      expect(all.json().fonts.map((font: { id: string }) => font.id)).toEqual(["lora", "abel"]);

      const found = await api("GET", "/site-fonts/google?search=LOR");
      expect(found.json()).toEqual({
        fonts: [
          {
            id: "lora",
            family: "Lora",
            category: "serif",
            weights: ["400", "500", "700"],
            hasItalic: true,
          },
        ],
        total: 1,
      });
      expect((await api("GET", "/site-fonts/google?category=sans")).json().fonts).toHaveLength(1);
      // The list is kept, so Fontsource is asked once.
      expect(services.asked.filter((url) => url.endsWith("/v1/fonts"))).toHaveLength(1);
    });

    it("downloads the chosen weights for Latin alphabets, and the site serves them itself", async () => {
      const added = await api("POST", "/site-fonts/google", {
        id: "lora",
        weights: ["400", "700", "900"],
        italic: true,
      });

      expect(added.statusCode, added.body).toBe(201);
      expect(added.json()).toMatchObject({
        family: "Lora",
        category: "serif",
        source: "google",
        sourceId: "lora",
      });
      expect(added.json().weights).toEqual(["400", "700"]);
      const downloads = services.asked.filter((url) => url.includes("jsdelivr"));
      expect(downloads).toHaveLength(8);
      expect(downloads.some((url) => url.includes("cyrillic"))).toBe(false);
      for (const url of services.asked) {
        expect(["api.fontsource.org", "cdn.jsdelivr.net"]).toContain(new URL(url).hostname);
      }

      const { html, css } = await visitHome();
      expect(css).toContain("font-family: 'Lora';");
      expect(css).toContain("unicode-range: U+0100-02BA;");
      expect(css).not.toContain("jsdelivr");
      expect(html).not.toContain("fonts.googleapis.com");
    });

    it("previews a family through Lintel", async () => {
      const preview = await server.inject({
        method: "GET",
        url: "/site-fonts/google/lora/preview",
        cookies: await signInAndGetCookies(server, "owner@example.com"),
      });
      expect(preview.statusCode).toBe(200);
      expect(preview.headers["content-type"]).toBe("font/woff2");
      expect(preview.rawPayload.subarray(0, 4).toString("latin1")).toBe("wOF2");
    });

    it("says plainly when Google Fonts can't be reached", async () => {
      services.offline = true;
      const response = await api("GET", "/site-fonts/google?search=lora");
      expect(response.statusCode).toBe(503);
      expect(response.json().message).toContain("couldn't reach Google Fonts");
      expect(response.json().message).toContain("fonts that come with Lintel still work");
    });

    it("refuses a family it doesn't have", async () => {
      expect(
        (await api("POST", "/site-fonts/google", { id: "nope", weights: ["400"] })).statusCode,
      ).toBe(404);
      expect(
        (await api("POST", "/site-fonts/google", { id: "../x", weights: ["400"] })).statusCode,
      ).toBe(400);
    });

    it("deletes the files a family downloaded when adding it fails part of the way", async () => {
      services.italicsFail = true;
      const before = (await api("GET", "/media")).json().total;
      const failed = await api("POST", "/site-fonts/google", {
        id: "lora",
        weights: ["400", "700"],
        italic: true,
      });
      expect(failed.statusCode).toBe(503);
      expect((await api("GET", "/site-fonts")).json().fonts).toEqual([]);
      expect((await api("GET", "/media")).json().total).toBe(before);
    });

    it("deletes the files a family's new download replaced", async () => {
      const site = await findOrCreateDefaultSite(testDatabase.database);
      const context = server.siteFonts.context();
      const lora = await context.google.findFont("lora");
      let contents = await fontFile("lora-latin-400-normal.woff2");
      // Fontsource has changed the file since it was first downloaded.
      const google: GoogleFontsClient = {
        ...context.google,
        findFont: async () => lora,
        downloadFile: async () => contents,
      };
      const first = await addGoogleFont({ ...context, google }, site, request(), ownerId);
      contents = await fontFile("inter-latin-400-normal.woff2");
      const again = await addGoogleFont({ ...context, google }, site, request(), ownerId);

      const before = first.files.map((file) => file.assetId);
      const after = again.files.map((file) => file.assetId);
      expect(after).not.toEqual(before);
      const media = (await api("GET", "/media")).json().assets as { id: string }[];
      expect(media.map((asset) => asset.id).sort()).toEqual([...new Set(after)].sort());
    });

    it("lets a site have at most 40 fonts", async () => {
      const site = await findOrCreateDefaultSite(testDatabase.database);
      for (let index = 0; index < MAX_FONTS_PER_SITE; index += 1) {
        await insertNewSiteFont(testDatabase.database, {
          tenantId: DEFAULT_TENANT_ID,
          siteId: site.id,
          family: `Family ${index}`,
          category: "sans",
          source: "upload",
          files: [],
        });
      }
      const refused = await api("POST", "/site-fonts/google", { id: "lora", weights: ["400"] });
      expect(refused.statusCode).toBe(409);
      expect(refused.json().code).toBe("TOO_MANY_SITE_FONTS");
      // Nothing it downloaded is left behind.
      expect((await api("GET", "/media")).json().total).toBe(0);
    });

    it("says a name is taken when two people add the same family at once", async () => {
      const site = await findOrCreateDefaultSite(testDatabase.database);
      const row = {
        tenantId: DEFAULT_TENANT_ID,
        siteId: site.id,
        family: "Same Name",
        category: "sans" as const,
        source: "upload" as const,
        files: [],
      };
      const results = await Promise.allSettled([
        insertNewSiteFont(testDatabase.database, row),
        insertNewSiteFont(testDatabase.database, row),
      ]);
      const refused = results.find((result) => result.status === "rejected");
      expect(refused?.status === "rejected" && refused.reason).toBeInstanceOf(
        SiteFontNameTakenError,
      );
    });

    it("removes the downloaded files with the font", async () => {
      const added = (
        await api("POST", "/site-fonts/google", { id: "lora", weights: ["400"] })
      ).json();
      const assetId = added.files[0].assetId;

      expect((await api("DELETE", `/site-fonts/${added.id}`)).statusCode).toBe(204);

      expect((await api("GET", "/site-fonts")).json().fonts).toEqual([]);
      expect((await api("GET", `/media/${assetId}`)).statusCode).toBe(404);
      expect((await visitHome()).css).not.toContain(assetId);
    });
  });

  describe("Adobe Fonts", () => {
    it("lists a project's families and links Adobe's stylesheet on every page, once allowed", async () => {
      const connected = await api("POST", "/site-fonts/adobe", { projectId: "ABC1DEF" });

      expect(connected.statusCode, connected.body).toBe(200);
      expect(connected.json().adobeProjects).toEqual([
        {
          projectId: "abc1def",
          stylesheetUrl: "https://use.typekit.net/abc1def.css",
          families: ["proxima-nova", "freight-text-pro"],
        },
      ]);
      expect(connected.json().fonts).toEqual([
        expect.objectContaining({ family: "proxima-nova", category: "sans", source: "adobe" }),
        expect.objectContaining({ family: "freight-text-pro", category: "serif", source: "adobe" }),
      ]);

      // Adobe's stylesheet waits for visitors to allow it in the cookie notice (LINTEL-UX-041).
      const { html } = await visitHome();
      expect(html).not.toContain('<link rel="stylesheet" href="https://use.typekit.net');
      expect(html).toContain('"fontStylesheets":["https://use.typekit.net/abc1def.css"]');
      await api("PUT", "/website/cookie-notice", { mode: "off" });
      expect((await visitHome()).html).toContain(
        '<link rel="stylesheet" href="https://use.typekit.net/abc1def.css"/>',
      );

      await api("DELETE", "/site-fonts/adobe/abc1def");
      expect((await visitHome()).html).not.toContain("typekit");
    });

    it("explains a wrong, unknown or empty project", async () => {
      const wrong = await api("POST", "/site-fonts/adobe", { projectId: "https://evil.example/" });
      expect(wrong.statusCode).toBe(400);
      expect(wrong.json().message).toContain("like abc1def");
      const unknown = await api("POST", "/site-fonts/adobe", { projectId: "zzz9999" });
      expect(unknown.statusCode).toBe(404);
      expect(unknown.json().message).toContain("Web projects");
      expect((await api("POST", "/site-fonts/adobe", { projectId: "empty12" })).statusCode).toBe(
        422,
      );
      services.offline = true;
      const offline = await api("POST", "/site-fonts/adobe", { projectId: "abc1def" });
      expect(offline.json().message).toContain("couldn't reach Adobe Fonts");
    });
  });

  it("lets the theme use a site font for headings and body text", async () => {
    await api("POST", "/site-fonts/google", { id: "lora", weights: ["400"] });

    const saved = await api("PUT", "/website", { headingFont: "Lora", bodyFont: "Inter" });
    expect(saved.statusCode, saved.body).toBe(200);
    expect(saved.json()).toMatchObject({ headingFont: "Lora", bodyFont: "Inter" });

    const { css } = await visitHome();
    expect(css).toContain("--lintel-font-heading: 'Lora', Georgia, serif;");
    expect(css).toContain("--lintel-font-body: 'Inter', system-ui, sans-serif;");
  });

  it("gives the builder's canvas the site's fonts and Adobe's stylesheet", async () => {
    await api("POST", "/site-fonts/google", { id: "lora", weights: ["400"] });
    await api("POST", "/site-fonts/adobe", { projectId: "abc1def" });
    const canvas = (await api("GET", "/website/canvas")).json();
    expect(canvas.fonts).toEqual([
      { family: "Lora", category: "serif", source: "google" },
      { family: "proxima-nova", category: "sans", source: "adobe" },
      { family: "freight-text-pro", category: "serif", source: "adobe" },
    ]);
    expect(canvas.fontStylesheets).toEqual(["https://use.typekit.net/abc1def.css"]);
  });

  it("keeps each site's fonts apart", async () => {
    await api("POST", "/sites", {
      handle: "france",
      name: "France",
      hostnames: ["acme.fr"],
      defaultLocale: "fr-FR",
    });
    await api("POST", "/site-fonts/google", { id: "lora", weights: ["400"] });
    const france = requestsAs(server, await signInAndGetCookies(server, "owner@example.com"), {
      "lintel-site": "france",
    });
    expect((await france("GET", "/site-fonts")).json().fonts).toEqual([]);
  });

  it("lets editors see the fonts, but only people who change settings add them", async () => {
    await createTestUser(testDatabase.database, "editor@example.com", [
      ["entries:read", "media:upload"],
    ]);
    const editor = requestsAs(server, await signInAndGetCookies(server, "editor@example.com"));
    expect((await editor("GET", "/site-fonts")).statusCode).toBe(200);
    expect((await editor("GET", "/site-fonts/google")).statusCode).toBe(403);
    expect((await editor("POST", "/site-fonts/adobe", { projectId: "abc1def" })).statusCode).toBe(
      403,
    );
    expect(services.asked).toHaveLength(0);
  });
});
