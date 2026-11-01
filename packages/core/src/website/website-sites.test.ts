import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensurePagesCollection } from "../collections/default-collections.js";
import { ensureSiteSettings } from "../globals/default-globals.js";
import { ensureMainMenu } from "../navigation/default-navigation.js";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { buildSiteServer } from "./site-server.js";

describe("the built-in website with several sites", () => {
  const testDatabase = useTestDatabase();
  let api: FastifyInstance;
  let website: FastifyInstance;
  let uk: SendRequest;
  let france: SendRequest;

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
  });
});
