import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensurePagesCollection } from "../collections/default-collections.js";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";

describe("a site's languages", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let api: SendRequest;

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase);
    await createTestUser(testDatabase.database, "ana@example.com", [["*"]]);
    api = requestsAs(server, await signInAndGetCookies(server, "ana@example.com"));
  });

  afterEach(() => server.close());

  it("starts with the site's main language", async () => {
    const response = await api("GET", "/locales");

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      defaultLocale: "en-GB",
      locales: [{ code: "en-GB", name: "British English", isDefault: true, entryCount: 0 }],
    });
  });

  it("adds languages by code, tidying the code and naming them in English", async () => {
    const french = await api("POST", "/locales", { code: "FR-fr" });
    const welsh = await api("POST", "/locales", { code: "cy", name: "Cymraeg" });
    const again = await api("POST", "/locales", { code: "fr-FR" });
    const nonsense = await api("POST", "/locales", { code: "not a language" });

    expect(french.statusCode).toBe(201);
    expect(french.json()).toEqual({
      code: "fr-FR",
      name: "French (France)",
      isDefault: false,
      entryCount: 0,
    });
    expect(welsh.json().name).toBe("Cymraeg");
    expect(again.json()).toMatchObject({
      code: "LOCALE_EXISTS",
      message: "French (France) is already one of this site's languages.",
    });
    expect(nonsense.statusCode).toBe(400);
    expect(
      (await api("GET", "/locales")).json().locales.map((l: { code: string }) => l.code),
    ).toEqual(["en-GB", "fr-FR", "cy"]);
  });

  it("renames a language, and removes one only when nothing is written in it", async () => {
    await ensurePagesCollection(testDatabase.database);
    await api("POST", "/locales", { code: "fr-FR" });
    await api("POST", "/locales", { code: "de" });
    await api("POST", "/collections/pages/entries", {
      data: { title: "Accueil" },
      locale: "fr-FR",
    });

    const renamed = await api("PATCH", "/locales/fr-fr", { name: "Français" });
    const inUse = await api("DELETE", "/locales/fr-FR");
    const mainLanguage = await api("DELETE", "/locales/en-GB");
    const unused = await api("DELETE", "/locales/de");

    expect(renamed.json()).toMatchObject({ name: "Français", entryCount: 1 });
    expect((await api("GET", "/locales")).json().locales).toMatchObject([
      { code: "en-GB", entryCount: 0 },
      { code: "fr-FR", entryCount: 1 },
    ]);
    expect(inUse.json()).toMatchObject({
      code: "LOCALE_IN_USE",
      message: "1 entry is written in Français. Delete them first, so nothing is lost by accident.",
    });
    expect(mainLanguage.json().code).toBe("DEFAULT_LOCALE");
    expect(unused.statusCode).toBe(204);
    expect((await api("DELETE", "/locales/de")).statusCode).toBe(404);
  });

  it("lets anyone signed in list the languages, but only settings managers change them", async () => {
    await createTestUser(testDatabase.database, "writer@example.com", [["entries:*"]]);
    const writer = requestsAs(server, await signInAndGetCookies(server, "writer@example.com"));

    expect((await writer("GET", "/locales")).statusCode).toBe(200);
    expect((await writer("POST", "/locales", { code: "fr" })).statusCode).toBe(403);
    expect((await server.inject({ method: "GET", url: "/locales" })).statusCode).toBe(401);
  });

  it("tells websites which languages there are", async () => {
    await api("POST", "/locales", { code: "fr-FR", name: "Français" });

    const response = await server.inject({ method: "GET", url: "/delivery/locales" });

    expect(response.headers["cache-control"]).toBe("public, max-age=60");
    expect(response.json()).toEqual({
      defaultLocale: "en-GB",
      locales: [
        { code: "en-GB", name: "British English" },
        { code: "fr-FR", name: "Français" },
      ],
    });
  });
});
