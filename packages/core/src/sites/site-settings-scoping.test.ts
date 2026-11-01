import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensurePagesCollection } from "../collections/default-collections.js";
import { useTestDatabase } from "../testing/test-database.js";
import { createHomePage } from "../testing/test-home-page.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";

/** Menus, global values, taxonomies, sitemaps and previews, each kept per site. */
describe("site settings on several sites", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let uk: SendRequest;
  let france: SendRequest;

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase);
    await ensurePagesCollection(testDatabase.database);
    await createTestUser(testDatabase.database, "admin@example.com", [["*"]]);
    const cookies = await signInAndGetCookies(server, "admin@example.com");
    uk = requestsAs(server, cookies);
    france = requestsAs(server, cookies, { "lintel-site": "france" });
    await uk("POST", "/sites", {
      handle: "france",
      name: "Acme France",
      hostnames: ["acme.fr"],
      siteUrl: "https://www.acme.fr",
      defaultLocale: "fr-FR",
    });
  });

  afterEach(() => server.close());

  function get(url: string, headers: Record<string, string> = {}) {
    return server.inject({ method: "GET", url, headers });
  }

  async function publish(api: SendRequest, title: string) {
    const created = await api("POST", "/collections/pages/entries", { data: { title } });
    await api("POST", `/entries/${created.json().id}/publish`);
    return created.json() as { id: string };
  }

  it("gives each site its own menus", async () => {
    const about = await publish(uk, "About us");
    await uk("POST", "/navigation", { handle: "main", name: "Main menu" });
    await france("POST", "/navigation", { handle: "main", name: "Menu principal" });
    await uk("PUT", "/navigation/main", {
      items: [{ id: "5b0e1c52-3f4a-4c55-9d2e-6c1f0a7b8e91", entryId: about.id, newTab: false }],
    });

    const english = await get("/delivery/navigation/main");
    const french = await get("/delivery/navigation/main?site=france");

    expect(english.json()).toMatchObject({ name: "Main menu", items: [{ label: "About us" }] });
    expect(french.json()).toMatchObject({ name: "Menu principal", locale: "fr-FR", items: [] });
  });

  it("shares global sets' fields but keeps each site's values", async () => {
    await uk("POST", "/globals", {
      handle: "footer",
      name: "Footer",
      fields: [
        { handle: "note", label: "Note", type: "text", required: false, helpText: "", options: {} },
      ],
    });
    await uk("PATCH", "/globals/footer/values", { data: { note: "Made in Leeds" } });
    await france("PATCH", "/globals/footer/values", { data: { note: "Fait à Lyon" } });

    expect((await get("/delivery/globals/footer")).json().data.note).toBe("Made in Leeds");
    expect((await get("/delivery/globals/footer", { host: "acme.fr" })).json()).toMatchObject({
      locale: "fr-FR",
      data: { note: "Fait à Lyon" },
    });
    expect((await france("GET", "/globals/footer")).json().data.note).toBe("Fait à Lyon");
    expect((await get("/delivery/globals?site=france")).json().globals.footer.note).toBe(
      "Fait à Lyon",
    );
  });

  it("keeps a site's own taxonomies to that site, and shares the rest", async () => {
    await uk("POST", "/taxonomies", { handle: "topics", name: "Topics" });
    const regions = await france("POST", "/taxonomies", {
      handle: "regions",
      name: "Régions",
      siteHandle: "france",
    });
    await france("POST", "/taxonomies/regions/terms", { title: "Bretagne" });

    const handlesFor = async (api: SendRequest) =>
      (await api("GET", "/taxonomies"))
        .json()
        .taxonomies.map((taxonomy: { handle: string }) => taxonomy.handle);

    expect(regions.json().siteId).toEqual(expect.any(String));
    expect(await handlesFor(uk)).toEqual(["topics"]);
    expect(await handlesFor(france)).toEqual(["regions", "topics"]);
    expect((await get("/delivery/taxonomies/regions")).statusCode).toBe(404);
    expect((await get("/delivery/taxonomies/regions?site=france")).json().items).toMatchObject([
      { slug: "bretagne" },
    ]);
    expect((await get("/delivery/taxonomies/topics?site=france")).statusCode).toBe(200);
  });

  it("writes a sitemap and robots.txt for each site, at its own address", async () => {
    await uk("PUT", "/plugins", { enabled: ["seo"] });
    await uk("PUT", "/site-address", { siteAddress: "https://www.acme.co.uk" });
    // Each site's first page at the top is its "/"; the pages under test come after.
    await createHomePage(uk);
    await createHomePage(france);
    await publish(uk, "About us");
    await publish(france, "À propos");

    const english = await get("/sitemap.xml");
    const french = await get("/sitemap.xml", { host: "acme.fr" });

    expect(english.body).toContain("<loc>https://www.acme.co.uk/about-us</loc>");
    expect(english.body).not.toContain("a-propos");
    expect(french.body).toContain("<loc>https://www.acme.fr/a-propos</loc>");
    expect(french.body).not.toContain("about-us");
    expect((await get("/robots.txt?site=france")).body).toContain(
      "Sitemap: https://www.acme.fr/sitemap.xml",
    );

    await uk("POST", "/sites", { handle: "spain", name: "Acme Spain", defaultLocale: "es" });
    expect((await get("/sitemap.xml?site=spain")).json()).toMatchObject({
      code: "SITE_ADDRESS_MISSING",
      message: expect.stringContaining("Acme Spain's address"),
    });
  });

  it("previews a draft on its own site's website", async () => {
    await uk("PUT", "/collections/pages", {
      previewUrlPattern: "{siteUrl}/api/preview?path={url}&site={site}",
    });
    await uk("PATCH", "/sites/france", { pathPrefix: "/fr" });
    await createHomePage(france);
    const draft = await france("POST", "/collections/pages/entries", {
      data: { title: "À propos" },
    });

    const preview = await france("POST", `/entries/${draft.json().id}/preview`);
    const previewed = await get(`/preview?token=${preview.json().token}`);

    expect(preview.json().previewUrl).toMatch(
      /^https:\/\/www\.acme\.fr\/api\/preview\?path=\/fr\/a-propos&site=france&preview=/,
    );
    expect(previewed.json()).toMatchObject({
      collection: "pages",
      site: "france",
      entry: { slug: "a-propos", url: "/fr/a-propos" },
    });
  });
});
