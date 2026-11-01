import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ensureBlogPostsCollection,
  ensurePagesCollection,
} from "../collections/default-collections.js";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";

/**
 * Two sites in one install: the default (Acme UK, in English) and Acme France (in French,
 * on acme.fr). `uk` works on the default site and `france` on the French one, as the admin
 * does by sending the Lintel-Site header.
 */
describe("entries on several sites", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let uk: SendRequest;
  let france: SendRequest;

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase);
    await ensurePagesCollection(testDatabase.database);
    await ensureBlogPostsCollection(testDatabase.database);
    await createTestUser(testDatabase.database, "admin@example.com", [["*"]]);
    const cookies = await signInAndGetCookies(server, "admin@example.com");
    uk = requestsAs(server, cookies);
    france = requestsAs(server, cookies, { "lintel-site": "france" });
    await uk("PATCH", "/sites/default", { name: "Acme UK", hostnames: ["acme.co.uk"] });
    await uk("POST", "/sites", {
      handle: "france",
      name: "Acme France",
      hostnames: ["acme.fr"],
      defaultLocale: "fr-FR",
    });
  });

  afterEach(() => server.close());

  async function publish(api: SendRequest, title: string, collection = "pages") {
    const created = await api("POST", `/collections/${collection}/entries`, { data: { title } });
    await api("POST", `/entries/${created.json().id}/publish`);
    return created.json() as { id: string; slug: string; locale: string };
  }

  function get(url: string, headers: Record<string, string> = {}) {
    return server.inject({ method: "GET", url, headers });
  }

  const slugsIn = (response: {
    json: () => { entries?: { slug: string }[]; items?: { slug: string }[] };
  }) => (response.json().entries ?? response.json().items ?? []).map((entry) => entry.slug);

  it("keeps each site's entries apart, in the admin and on the website", async () => {
    await publish(uk, "About us");
    await publish(uk, "Contact");
    const frenchPage = await publish(france, "À propos");
    await publish(france, "Contact");

    expect(frenchPage.locale).toBe("fr-FR");
    expect(slugsIn(await uk("GET", "/collections/pages/entries"))).toEqual(["about-us", "contact"]);
    expect(slugsIn(await france("GET", "/collections/pages/entries"))).toEqual([
      "a-propos",
      "contact",
    ]);

    expect(slugsIn(await get("/delivery/pages"))).toEqual(["about-us", "contact"]);
    expect(slugsIn(await get("/delivery/pages?site=france"))).toEqual(["a-propos", "contact"]);
    expect(slugsIn(await get("/delivery/pages", { host: "acme.fr" }))).toEqual([
      "a-propos",
      "contact",
    ]);
    expect(slugsIn(await get("/delivery/pages", { "lintel-site": "france" }))).toEqual([
      "a-propos",
      "contact",
    ]);
    expect((await get("/delivery/pages/a-propos")).statusCode).toBe(404);
    expect((await get("/delivery/pages/a-propos?site=france")).json().data.title).toBe("À propos");
    expect((await get("/delivery/pages?site=france")).headers.vary).toContain("Lintel-Site");
  });

  it("puts the site's path prefix in front of its addresses", async () => {
    await uk("PATCH", "/sites/france", { hostnames: ["acme.co.uk"], pathPrefix: "/fr" });
    await publish(france, "À propos");

    const delivered = await get("/delivery/pages/a-propos?site=france");

    expect(delivered.json().url).toBe("/fr/a-propos");
    expect(slugsIn(await get("/delivery/pages", { host: "acme.co.uk" }))).toEqual([]);
  });

  it("shows a shared collection's entries on every site", async () => {
    const pages = (await uk("GET", "/collections/pages")).json();
    await uk("POST", "/collections", {
      handle: "team",
      name: "Team",
      blueprintHandle: pages.blueprintHandle,
      structure: "flat",
      routePattern: null,
      siteScope: "shared",
    });
    await publish(france, "Marie", "team");

    expect(slugsIn(await uk("GET", "/collections/team/entries"))).toEqual(["marie"]);
    expect(slugsIn(await get("/delivery/team"))).toEqual(["marie"]);
    expect(slugsIn(await get("/delivery/team?site=france"))).toEqual(["marie"]);
  });

  it("won't share a collection while other sites have entries of their own in it", async () => {
    await publish(france, "À propos");

    const response = await uk("PUT", "/collections/pages", { siteScope: "shared" });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: "COLLECTION_HAS_SITE_ENTRIES", entryCount: 1 });
  });

  it("can keep a collection to some sites", async () => {
    const limited = await uk("PUT", "/collections/posts", { siteHandles: ["default"] });

    expect(limited.json()).toMatchObject({ siteScope: "per-site", siteIds: [expect.any(String)] });
    const frenchCollections = (await france("GET", "/collections")).json().collections;
    expect(frenchCollections.map((collection: { handle: string }) => collection.handle)).toEqual([
      "pages",
    ]);
    expect((await uk("GET", "/collections?site=all")).json().collections).toHaveLength(2);
    expect((await france("GET", "/collections/posts/entries")).statusCode).toBe(404);
    expect((await get("/delivery/posts?site=france")).statusCode).toBe(404);
    expect((await get("/delivery/posts")).statusCode).toBe(200);
  });

  it("copies an entry to another site as a draft, keeping its slug where it can", async () => {
    const about = await publish(uk, "About us");

    const copy = await uk("POST", `/entries/${about.id}/copy-to-site`, { site: "france" });
    const secondCopy = await uk("POST", `/entries/${about.id}/copy-to-site`, { site: "france" });
    const sameSite = await uk("POST", `/entries/${about.id}/copy-to-site`, { site: "default" });

    expect(copy.statusCode).toBe(201);
    expect(copy.json()).toMatchObject({ slug: "about-us", locale: "fr-FR", status: "draft" });
    expect(secondCopy.json().slug).toBe("about-us-2");
    expect(sameSite.statusCode).toBe(400);
    expect(slugsIn(await france("GET", "/collections/pages/entries"))).toEqual([
      "about-us",
      "about-us-2",
    ]);
    expect(slugsIn(await uk("GET", "/collections/pages/entries"))).toEqual(["about-us"]);
  });

  it("answers GraphQL for the site asked for", async () => {
    await publish(uk, "About us");
    await publish(france, "À propos");

    const query = (url: string) =>
      server.inject({
        method: "POST",
        url,
        payload: { query: "{ pages { total items { slug } } }" },
      });

    expect((await query("/graphql")).json().data.pages.items).toEqual([{ slug: "about-us" }]);
    expect((await query("/graphql?site=france")).json().data.pages.items).toEqual([
      { slug: "a-propos" },
    ]);
  });

  it("keeps each site's languages apart", async () => {
    await france("POST", "/locales", { code: "nl-BE" });

    const french = (await france("GET", "/locales")).json();
    const english = (await uk("GET", "/locales")).json();

    expect(french.defaultLocale).toBe("fr-FR");
    expect(french.locales.map((locale: { code: string }) => locale.code)).toEqual([
      "fr-FR",
      "nl-BE",
    ]);
    expect(english.locales.map((locale: { code: string }) => locale.code)).toEqual(["en-GB"]);
    expect((await get("/delivery/locales?site=france")).json().defaultLocale).toBe("fr-FR");
  });
});
