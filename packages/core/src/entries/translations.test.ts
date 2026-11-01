import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ensureBlogPostsCollection,
  ensurePagesCollection,
} from "../collections/default-collections.js";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";

describe("translations", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let api: SendRequest;

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase);
    await ensurePagesCollection(testDatabase.database);
    await ensureBlogPostsCollection(testDatabase.database);
    await createTestUser(testDatabase.database, "ana@example.com", [["*"]]);
    api = requestsAs(server, await signInAndGetCookies(server, "ana@example.com"));
    await api("POST", "/locales", { code: "fr-FR", name: "Français" });
  });

  afterEach(() => server.close());

  function deliver(url: string) {
    return server.inject({ method: "GET", url });
  }

  async function createPage(data: Record<string, unknown>, extra: Record<string, unknown> = {}) {
    return (await api("POST", "/collections/pages/entries", { data, ...extra })).json();
  }

  it("starts a draft translation as a copy, with the same slug, linked to its origin", async () => {
    const about = await createPage({ title: "About us", summary: "Who we are" });

    const response = await api("POST", `/entries/${about.id}/translations`, { locale: "fr-fr" });

    expect(response.statusCode).toBe(201);
    const french = response.json();
    expect(french).toMatchObject({
      locale: "fr-FR",
      originId: about.id,
      slug: "about-us",
      status: "draft",
      data: { title: "About us", summary: "Who we are" },
      translations: [{ id: about.id, locale: "en-GB", title: "About us", status: "draft" }],
    });
    expect((await api("GET", `/entries/${about.id}`)).json().translations).toEqual([
      { id: french.id, locale: "fr-FR", title: "About us", status: "draft" },
    ]);
  });

  it("refuses a second translation into the same language, or into the entry's own", async () => {
    const about = await createPage({ title: "About us" });
    const french = (
      await api("POST", `/entries/${about.id}/translations`, { locale: "fr-FR" })
    ).json();

    const again = await api("POST", `/entries/${about.id}/translations`, { locale: "fr-FR" });
    const own = await api("POST", `/entries/${french.id}/translations`, { locale: "fr-FR" });
    const unknown = await api("POST", `/entries/${about.id}/translations`, { locale: "de" });

    expect(again.json()).toMatchObject({ code: "TRANSLATION_EXISTS", translationId: french.id });
    expect(own.statusCode).toBe(400);
    expect(unknown.statusCode).toBe(404);
  });

  it("lists, slugs and nests entries per language", async () => {
    const about = await createPage({ title: "About us" });
    const team = await createPage({ title: "Team" }, { parentId: about.id });
    const frenchAbout = (
      await api("POST", `/entries/${about.id}/translations`, { locale: "fr-FR" })
    ).json();
    const frenchTeam = (
      await api("POST", `/entries/${team.id}/translations`, { locale: "fr-FR" })
    ).json();
    const frenchOnly = await createPage({ title: "Team" }, { locale: "fr-FR" });

    expect(frenchTeam.parentId).toBe(frenchAbout.id);
    expect(frenchOnly.slug).toBe("team-2");

    const english = await api("GET", "/collections/pages/entries");
    const french = await api("GET", "/collections/pages/entries?locale=fr-FR");
    expect(english.json().entries.map((entry: { id: string }) => entry.id)).toEqual([
      about.id,
      team.id,
    ]);
    expect(french.json().total).toBe(3);

    const crossLanguageParent = await api("PATCH", `/entries/${frenchOnly.id}`, {
      parentId: about.id,
    });
    expect(crossLanguageParent.json().message).toBe(
      "The parent has to be written in the same language.",
    );
  });

  it("delivers each language at its own address, with links to the others", async () => {
    const about = await createPage({ title: "About us" });
    const french = (
      await api("POST", `/entries/${about.id}/translations`, { locale: "fr-FR" })
    ).json();
    await api("PATCH", `/entries/${french.id}`, { data: { title: "À propos" }, slug: "a-propos" });
    await api("POST", `/entries/${about.id}/publish`);
    await api("POST", `/entries/${french.id}/publish`);

    const englishPage = await deliver("/delivery/pages/about-us");
    const frenchPage = await deliver("/delivery/pages/a-propos?locale=fr-FR");

    expect(englishPage.json()).toMatchObject({
      locale: "en-GB",
      data: { title: "About us" },
      translations: [{ locale: "fr-FR", slug: "a-propos", url: "/a-propos" }],
    });
    expect(frenchPage.json()).toMatchObject({
      locale: "fr-FR",
      data: { title: "À propos" },
      translations: [{ locale: "en-GB", slug: "about-us", url: "/about-us" }],
    });
    expect((await deliver("/delivery/pages/a-propos")).statusCode).toBe(404);
    expect((await deliver("/delivery/pages?locale=fr-FR")).json().total).toBe(1);
    expect((await deliver("/delivery/pages?locale=xx")).statusCode).toBe(404);
  });

  it("keeps a translation when its origin is deleted", async () => {
    const about = await createPage({ title: "About us" });
    const french = (
      await api("POST", `/entries/${about.id}/translations`, { locale: "fr-FR" })
    ).json();

    await api("DELETE", `/entries/${about.id}`);

    expect((await api("GET", `/entries/${french.id}`)).json()).toMatchObject({
      originId: null,
      translations: [],
    });
  });
});
