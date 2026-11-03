import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensurePagesCollection } from "../collections/default-collections.js";
import { ensureSiteSettings } from "../globals/default-globals.js";
import { ensureMainMenu } from "../navigation/default-navigation.js";
import { useTestDatabase } from "../testing/test-database.js";
import { createHomePage } from "../testing/test-home-page.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { buildSiteServer } from "./site-server.js";

describe("the built-in website with several sites", () => {
  const testDatabase = useTestDatabase();
  let api: FastifyInstance;
  let website: FastifyInstance;
  let uk: SendRequest;
  let france: SendRequest;
  let franceHome: string;

  beforeEach(async () => {
    api = await startTestServer(testDatabase.activeDatabase, {
      website: { builtInSiteUrl: "http://localhost:3999" },
    });
    website = buildSiteServer({ api });
    await website.ready();
    await ensurePagesCollection(testDatabase.database);
    await ensureSiteSettings(testDatabase.database);
    await ensureMainMenu(testDatabase.database);
    await createTestUser(testDatabase.database, "owner@example.com", [["*"]]);
    const cookies = await signInAndGetCookies(api, "owner@example.com");
    uk = requestsAs(api, cookies);
    france = requestsAs(api, cookies, { "lintel-site": "france" });
    await uk("PATCH", "/sites/default", { name: "Acme UK", hostnames: ["acme.co.uk"] });
    const created = await uk("POST", "/sites", {
      handle: "france",
      name: "Acme France",
      hostnames: ["acme.fr"],
      defaultLocale: "fr-FR",
    });
    expect(created.statusCode, created.body).toBe(201);
    await uk("PATCH", "/globals/site_settings/values", { data: { site_name: "Acme UK" } });
    await france("PATCH", "/globals/site_settings/values", { data: { site_name: "Acme France" } });
    // Each site's first page at the top is its "/", so the pages below answer at their own.
    await createHomePage(uk);
    franceHome = await createHomePage(france);
  });

  afterEach(async () => {
    await website.close();
    await api.close();
  });

  async function publish(api: SendRequest, title: string) {
    const created = await api("POST", "/collections/pages/entries", { data: { title } });
    expect(created.statusCode, created.body).toBe(201);
    await api("POST", `/entries/${created.json().id}/publish`);
  }

  const visit = (url: string, host: string) =>
    website.inject({ method: "GET", url, headers: { host } });

  it("shows each site's own pages and name at its own domain", async () => {
    await publish(uk, "About us");
    await publish(france, "À propos");

    const english = await visit("/about-us", "acme.co.uk");
    expect(english.statusCode).toBe(200);
    expect(english.body).toContain("Acme UK");
    expect((await visit("/a-propos", "acme.co.uk")).statusCode).toBe(404);

    const french = await visit("/a-propos", "acme.fr");
    expect(french.statusCode).toBe(200);
    expect(french.body).toContain("Acme France");
    expect(french.body).toContain('lang="fr-FR"');
    expect((await visit("/about-us", "acme.fr")).statusCode).toBe(404);
  });

  it("shows the default site at an address no site lists", async () => {
    await publish(uk, "About us");
    expect((await visit("/about-us", "localhost:3999")).statusCode).toBe(200);
  });

  it("serves a site under its path prefix on a shared domain", async () => {
    await uk("PATCH", "/sites/france", { hostnames: ["acme.co.uk"], pathPrefix: "/fr" });
    await publish(france, "À propos");

    const french = await visit("/fr/a-propos", "acme.co.uk");
    expect(french.statusCode).toBe(200);
    expect(french.body).toContain("Acme France");
    // The website's own links keep the prefix: home, and the site's other languages. A new
    // site starts with its own navigation and footer (see src/site-sections).
    expect(french.body).toMatch(/<a class="[^"]*lintel-site-logo" href="\/fr"/);
    await france("POST", "/locales", { code: "en-GB" });
    const withLanguages = await visit("/fr/a-propos", "acme.co.uk");
    expect(withLanguages.body).toContain('<a href="/fr/en-GB" hreflang="en-GB" lang="en-GB">');
    expect(withLanguages.body).not.toMatch(/href="\/en-GB/);
    // A home page address redirects to the site's own root, not the domain's.
    await france("POST", `/entries/${franceHome}/publish`);
    const home = await visit("/fr/home", "acme.co.uk");
    expect(home.headers.location).toBe("/fr");
  });

  it("serves a site with only a path prefix on the default site's domain", async () => {
    // As set up out of the box: the default site lists no domain; "/fr" has none of its own.
    await uk("PATCH", "/sites/default", { hostnames: [] });
    const moved = await uk("PATCH", "/sites/france", { hostnames: [], pathPrefix: "/fr" });
    expect(moved.statusCode, moved.body).toBe(200);
    await publish(uk, "About us");
    await publish(france, "À propos");
    await france("POST", `/entries/${franceHome}/publish`);

    const home = await visit("/fr", "localhost:3999");
    expect(home.statusCode).toBe(200);
    expect(home.body).toContain("Acme France");
    const french = await visit("/fr/a-propos", "localhost:3999");
    expect(french.statusCode).toBe(200);
    expect(french.body).toContain("À propos");
    // The default site keeps everything else.
    const english = await visit("/about-us", "localhost:3999");
    expect(english.statusCode).toBe(200);
    expect(english.body).toContain("Acme UK");
    // The delivery API agrees.
    const matched = await uk("GET", "/delivery/sites/match?url=http://localhost:3999/fr/a-propos");
    expect(matched.json()).toMatchObject({ site: { handle: "france" }, path: "/a-propos" });
  });

  it("puts pages under their site start and the site's prefix, following the tree", async () => {
    await uk("PATCH", "/sites/france", { hostnames: ["acme.co.uk"], pathPrefix: "/fr" });
    const about = (
      await france("POST", "/collections/pages/entries", { data: { title: "Société" } })
    ).json().id;
    const team = (
      await france("POST", "/collections/pages/entries", {
        data: { title: "Équipe" },
        parentId: about,
      })
    ).json().id;
    await france("POST", `/entries/${about}/publish`);
    await france("POST", `/entries/${team}/publish`);

    // The delivery API's address has the site's prefix, the site start's slug and the tree.
    const delivered = await france("GET", "/delivery/pages/equipe");
    expect(delivered.json().url).toBe("/fr/societe/equipe");
    const page = await visit("/fr/societe/equipe", "acme.co.uk");
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain("Équipe");
    // The old flat address goes on to the new one; parents that aren't its own find nothing.
    expect((await visit("/fr/societe/equipe/", "acme.co.uk")).headers.location).toBe(
      "/fr/societe/equipe",
    );
    expect((await visit("/fr/elsewhere/equipe", "acme.co.uk")).statusCode).toBe(404);
  });

  it("answers on a site start's own domain, as a site does on its own", async () => {
    const shop = (
      await france("POST", "/collections/pages/entries", { data: { title: "Boutique" } })
    ).json().id;
    const boots = (
      await france("POST", "/collections/pages/entries", {
        data: { title: "Bottes" },
        parentId: shop,
      })
    ).json().id;
    await france("POST", `/entries/${shop}/publish`);
    await france("POST", `/entries/${boots}/publish`);
    const saved = await france("PUT", `/content-tree/entries/${shop}/hostnames`, {
      hostname: "boutique.acme.fr",
    });
    expect(saved.statusCode, saved.body).toBe(200);

    // The domain belongs to no site, but the site start's site answers there.
    const start = await visit("/", "boutique.acme.fr");
    expect(start.statusCode).toBe(200);
    expect(start.body).toContain("Boutique");
    expect(start.body).toContain("Acme France");
    expect((await visit("/bottes", "boutique.acme.fr")).statusCode).toBe(200);
    // The site's own pages aren't there, and the shop's pages send visitors to its domain.
    expect((await visit("/home", "boutique.acme.fr")).statusCode).toBe(404);
    expect((await visit("/boutique/bottes", "acme.fr")).statusCode).toBe(404);
    expect((await visit("/bottes", "acme.fr")).headers.location).toBe(
      "https://boutique.acme.fr/bottes",
    );
  });
});
