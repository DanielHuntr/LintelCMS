import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureBlogPostsCollection } from "../collections/default-collections.js";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { ensureSiteSettings } from "./default-globals.js";

describe("global sets", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let api: SendRequest;

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase);
    await ensureSiteSettings(testDatabase.database);
    await createTestUser(testDatabase.database, "ana@example.com", [["*"]]);
    api = requestsAs(server, await signInAndGetCookies(server, "ana@example.com"));
  });

  afterEach(() => server.close());

  function deliver(url: string) {
    return server.inject({ method: "GET", url });
  }

  it("starts every site with Site settings, made once", async () => {
    await ensureSiteSettings(testDatabase.database);

    const list = await api("GET", "/globals");
    const siteSettings = await api("GET", "/globals/site_settings");

    expect(list.json().globals).toEqual([
      expect.objectContaining({ handle: "site_settings", name: "Site settings", fieldCount: 4 }),
    ]);
    expect(siteSettings.json()).toMatchObject({
      locale: "en-GB",
      data: {},
      hasOwnValues: false,
    });
    expect(siteSettings.json().fields.map((field: { handle: string }) => field.handle)).toEqual([
      "site_name",
      "footer_text",
      "contact_email",
      "social_links",
    ]);
  });

  it("checks and saves values, merging them over what was saved", async () => {
    const first = await api("PATCH", "/globals/site_settings/values", {
      data: { site_name: "Acme Bakery", social_links: ["https://instagram.com/acme", ""] },
    });
    const second = await api("PATCH", "/globals/site_settings/values", {
      data: { footer_text: "Open daily", contact_email: "not an email" },
    });
    const third = await api("PATCH", "/globals/site_settings/values", {
      data: { footer_text: "Open daily" },
    });

    expect(first.json()).toMatchObject({
      hasOwnValues: true,
      data: { site_name: "Acme Bakery", social_links: ["https://instagram.com/acme"] },
    });
    expect(second.json().fields).toEqual({
      contact_email: "Contact email should be an email address, like name@example.com",
    });
    expect(third.json().data).toEqual({
      site_name: "Acme Bakery",
      footer_text: "Open daily",
      contact_email: null,
      social_links: ["https://instagram.com/acme"],
    });
  });

  it("keeps values per language, starting each from the main language's", async () => {
    await api("POST", "/locales", { code: "fr-FR" });
    await api("PATCH", "/globals/site_settings/values", {
      data: { site_name: "Acme Bakery", footer_text: "Open daily" },
    });

    const beforeTranslating = await api("GET", "/globals/site_settings?locale=fr-FR");
    const translated = await api("PATCH", "/globals/site_settings/values?locale=fr-FR", {
      data: { footer_text: "Ouvert tous les jours" },
    });
    const english = await api("GET", "/globals/site_settings");

    expect(beforeTranslating.json()).toMatchObject({
      locale: "fr-FR",
      hasOwnValues: false,
      data: { footer_text: "Open daily" },
    });
    expect(translated.json().data).toMatchObject({
      site_name: "Acme Bakery",
      footer_text: "Ouvert tous les jours",
    });
    expect(english.json().data.footer_text).toBe("Open daily");
    expect((await api("GET", "/globals/site_settings?locale=de")).statusCode).toBe(404);
  });

  it("changes a set's fields, without needing a title", async () => {
    const created = await api("POST", "/globals", {
      handle: "banner",
      name: "Banner",
      fields: [
        { handle: "message", label: "Message", type: "text" },
        { handle: "colour", label: "Colour", type: "colour" },
      ],
    });
    const duplicate = await api("PUT", "/globals/banner", {
      name: "Banner",
      fields: [
        { handle: "message", label: "Message", type: "text" },
        { handle: "message", label: "Again", type: "text" },
      ],
    });
    const taken = await api("POST", "/globals", { handle: "banner", name: "Again" });

    expect(created.statusCode).toBe(201);
    expect(created.json().fieldCount).toBe(2);
    expect(duplicate.json().fields).toEqual({
      message: `Two fields can't share the handle "message"`,
    });
    expect(taken.json().code).toBe("GLOBAL_SET_HANDLE_TAKEN");
    expect((await api("DELETE", "/globals/banner")).statusCode).toBe(204);
  });

  it("delivers globals with their values expanded, falling back to the main language", async () => {
    await ensureBlogPostsCollection(testDatabase.database);
    await api("POST", "/locales", { code: "fr-FR" });
    const { terms } = (await api("GET", "/taxonomies/categories/terms")).json();
    await api("POST", "/globals", {
      handle: "promotions",
      name: "Promotions",
      fields: [
        { handle: "notice", label: "Notice", type: "markdown" },
        {
          handle: "featured",
          label: "Featured",
          type: "terms",
          options: { taxonomy: "categories" },
        },
      ],
    });
    await api("PATCH", "/globals/promotions/values", {
      data: { notice: "**Sale** today", featured: [terms[0].id] },
    });
    await api("PATCH", "/globals/site_settings/values", { data: { site_name: "Acme" } });

    const one = await deliver("/delivery/globals/promotions?locale=fr-FR");
    const all = await deliver("/delivery/globals");

    expect(one.headers["cache-control"]).toBe("public, max-age=60");
    expect(one.json()).toEqual({
      handle: "promotions",
      name: "Promotions",
      locale: "fr-FR",
      data: {
        notice: { markdown: "**Sale** today", html: "<p><strong>Sale</strong> today</p>\n" },
        featured: [{ id: terms[0].id, title: "Guides", slug: "guides", taxonomy: "categories" }],
      },
    });
    expect(all.json()).toMatchObject({
      locale: "en-GB",
      globals: { site_settings: { site_name: "Acme", footer_text: null }, promotions: {} },
    });
    expect((await deliver("/delivery/globals/nope")).statusCode).toBe(404);
  });

  it("lets editors change values but not fields", async () => {
    await createTestUser(testDatabase.database, "editor@example.com", [["globals:*"]]);
    const editor = requestsAs(server, await signInAndGetCookies(server, "editor@example.com"));

    const values = await editor("PATCH", "/globals/site_settings/values", {
      data: { site_name: "Mine" },
    });
    const fields = await editor("PUT", "/globals/site_settings", { name: "X", fields: [] });

    expect(values.statusCode).toBe(200);
    expect(fields.statusCode).toBe(403);
  });
});
