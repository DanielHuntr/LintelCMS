import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensurePagesCollection } from "../collections/default-collections.js";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";

describe("managing sites", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let api: SendRequest;
  let onFrance: SendRequest;

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase);
    await createTestUser(testDatabase.database, "admin@example.com", [["*"]]);
    const cookies = await signInAndGetCookies(server, "admin@example.com");
    api = requestsAs(server, cookies);
    onFrance = requestsAs(server, cookies, { "lintel-site": "france" });
  });

  afterEach(() => server.close());

  const france = {
    handle: "france",
    name: "Acme France",
    hostnames: ["https://www.Acme.fr/", "acme.fr"],
    pathPrefix: "",
    siteUrl: "https://www.acme.fr/",
    defaultLocale: "FR-fr",
    extraLocales: ["en-GB"],
  };

  it("starts with the default site alone", async () => {
    const response = await api("GET", "/sites");

    expect(response.statusCode).toBe(200);
    expect(response.json().sites).toEqual([
      {
        id: expect.any(String),
        handle: "default",
        name: "Default site",
        isDefault: true,
        hostnames: [],
        pathPrefix: "",
        siteUrl: "",
        defaultLocale: "en-GB",
        locales: [{ code: "en-GB", name: "British English" }],
        branding: { logoAssetId: null, accentColor: null },
        entryCount: 0,
      },
    ]);
  });

  it("adds a site with its domains, address and languages, tidied", async () => {
    const created = await api("POST", "/sites", france);

    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({
      handle: "france",
      name: "Acme France",
      isDefault: false,
      hostnames: ["www.acme.fr", "acme.fr"],
      siteUrl: "https://www.acme.fr",
      defaultLocale: "fr-FR",
      locales: [
        { code: "fr-FR", name: "French (France)" },
        { code: "en-GB", name: "British English" },
      ],
    });
    const handles = (await api("GET", "/sites"))
      .json()
      .sites.map((site: { handle: string }) => site.handle);
    expect(handles).toEqual(["default", "france"]);
  });

  it("gives a new site empty copies of the default site's menus", async () => {
    await api("POST", "/navigation", { handle: "main", name: "Main menu" });
    expect((await api("POST", "/sites", france)).statusCode).toBe(201);

    const menus = await onFrance("GET", "/navigation");
    expect(menus.json().navigations).toMatchObject([
      { handle: "main", name: "Main menu", itemCount: 0 },
    ]);
  });

  it("refuses a taken handle, a bad domain and a domain another site answers on", async () => {
    await api("POST", "/sites", france);

    const sameHandle = await api("POST", "/sites", { ...france, hostnames: ["acme.be"] });
    const badDomain = await api("POST", "/sites", {
      ...france,
      handle: "belgium",
      hostnames: ["not a domain"],
    });
    const sameDomain = await api("POST", "/sites", {
      ...france,
      handle: "belgium",
      hostnames: ["acme.fr"],
    });
    const samePathElsewhere = await api("POST", "/sites", {
      ...france,
      handle: "belgium",
      hostnames: ["acme.fr"],
      pathPrefix: "/be",
    });

    expect(sameHandle.json().code).toBe("SITE_HANDLE_TAKEN");
    expect(badDomain.statusCode).toBe(400);
    expect(badDomain.json().message).toContain("isn't a domain");
    expect(sameDomain.json()).toMatchObject({
      code: "SITE_ADDRESS_TAKEN",
      message: expect.stringContaining("Acme France already answers on acme.fr"),
    });
    expect(samePathElsewhere.statusCode).toBe(201);
  });

  it("renames a site, changes its domains and branding, and switches its main language", async () => {
    await api("POST", "/sites", france);

    const changed = await api("PATCH", "/sites/france", {
      name: "Acme FR",
      hostnames: ["acme.fr"],
      defaultLocale: "en-GB",
      branding: { accentColor: "#FF6600" },
    });
    const unknownLanguage = await api("PATCH", "/sites/france", { defaultLocale: "de" });

    expect(changed.statusCode).toBe(200);
    expect(changed.json()).toMatchObject({
      name: "Acme FR",
      hostnames: ["acme.fr"],
      defaultLocale: "en-GB",
      branding: { logoAssetId: null, accentColor: "#ff6600" },
    });
    expect(unknownLanguage.statusCode).toBe(400);
    expect(unknownLanguage.json().message).toContain("isn't written in “de” yet");
  });

  it("deletes a site only when it is empty, and never the default", async () => {
    await ensurePagesCollection(testDatabase.database);
    await api("POST", "/sites", france);
    const page = await onFrance("POST", "/collections/pages/entries", {
      data: { title: "Accueil" },
    });

    expect((await api("DELETE", "/sites/default")).json().code).toBe("DEFAULT_SITE");
    expect((await api("DELETE", "/sites/france")).json()).toMatchObject({
      code: "SITE_HAS_ENTRIES",
      entryCount: 1,
    });

    await api("DELETE", `/entries/${page.json().id}`);
    expect((await api("DELETE", "/sites/france")).statusCode).toBe(204);
    expect((await api("GET", "/sites/france")).json().code).toBe("SITE_NOT_FOUND");
  });

  it("needs settings:update to change sites", async () => {
    await createTestUser(testDatabase.database, "editor@example.com", [["entries:*"]]);
    const editor = requestsAs(server, await signInAndGetCookies(server, "editor@example.com"));

    expect((await editor("GET", "/sites")).statusCode).toBe(200);
    expect((await editor("POST", "/sites", france)).statusCode).toBe(403);
  });
});

describe("sites for websites", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let api: SendRequest;

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase);
    await createTestUser(testDatabase.database, "admin@example.com", [["*"]]);
    api = requestsAs(server, await signInAndGetCookies(server, "admin@example.com"));
    await api("POST", "/sites", {
      handle: "global",
      name: "Acme",
      hostnames: ["acme.com"],
      siteUrl: "https://acme.com",
      defaultLocale: "en-GB",
    });
    await api("POST", "/sites", {
      handle: "france",
      name: "Acme France",
      hostnames: ["acme.com"],
      pathPrefix: "/fr",
      siteUrl: "https://acme.com",
      defaultLocale: "fr-FR",
    });
  });

  afterEach(() => server.close());

  function get(url: string, headers: Record<string, string> = {}) {
    return server.inject({ method: "GET", url, headers });
  }

  it("lists every site without signing in, leaving out ids and counts", async () => {
    const response = await get("/delivery/sites");

    expect(response.statusCode).toBe(200);
    expect(response.json().sites.map((site: { handle: string }) => site.handle)).toEqual([
      "default",
      "global",
      "france",
    ]);
    expect(response.json().sites[1]).not.toHaveProperty("id");
    expect(response.json().sites[1]).not.toHaveProperty("entryCount");
  });

  it("says which site a request is for: by ?site=, by header, by domain, else the default", async () => {
    const handleOf = async (url: string, headers?: Record<string, string>) =>
      (await get(url, headers)).json().handle;

    expect(await handleOf("/delivery/site?site=france")).toBe("france");
    expect(await handleOf("/delivery/site", { "lintel-site": "france" })).toBe("france");
    expect(await handleOf("/delivery/site", { host: "acme.com" })).toBe("global");
    expect(
      await handleOf("/delivery/site", { host: "api.internal", "x-forwarded-host": "acme.com" }),
    ).toBe("global");
    expect(await handleOf("/delivery/site", { host: "elsewhere.example" })).toBe("default");
    expect((await get("/delivery/site?site=nowhere")).json().code).toBe("SITE_NOT_FOUND");
  });

  it("matches a full address to its site and the path within it", async () => {
    const french = await get("/delivery/sites/match?url=https://acme.com/fr/a-propos");
    const english = await get("/delivery/sites/match?url=https://acme.com/about");
    const unknown = await get("/delivery/sites/match?url=https://nowhere.example/");

    expect(french.json()).toMatchObject({ site: { handle: "france" }, path: "/a-propos" });
    expect(english.json()).toMatchObject({ site: { handle: "global" }, path: "/about" });
    expect(unknown.statusCode).toBe(404);
  });
});
