import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";

describe("entries that link to other entries", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let api: SendRequest;

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase);
    await createTestUser(testDatabase.database, "ana@example.com", [["*"]]);
    api = requestsAs(server, await signInAndGetCookies(server, "ana@example.com"));
    await api("POST", "/blueprints", {
      handle: "recipe",
      name: "Recipe",
      fields: [
        { handle: "title", label: "Title", type: "text" },
        {
          handle: "related",
          label: "Related",
          type: "entries",
          options: { collections: ["recipes"] },
        },
        { handle: "method", label: "Method", type: "markdown" },
      ],
    });
    await api("POST", "/collections", {
      handle: "recipes",
      name: "Recipes",
      blueprintHandle: "recipe",
      structure: "flat",
    });
  });

  afterEach(() => server.close());

  async function createRecipe(data: Record<string, unknown>, publish = true): Promise<string> {
    const recipe = await api("POST", "/collections/recipes/entries", { data });
    if (publish) {
      await api("POST", `/entries/${recipe.json().id}/publish`);
    }
    return recipe.json().id;
  }

  it("delivers published links in the language asked for, leaving out drafts", async () => {
    await api("POST", "/locales", { code: "fr-FR" });
    const bread = await createRecipe({ title: "Bread" });
    const draft = await createRecipe({ title: "Secret sauce" }, false);
    const frenchBread = await api("POST", `/entries/${bread}/translations`, { locale: "fr-FR" });
    await api("PATCH", `/entries/${frenchBread.json().id}`, { data: { title: "Pain" } });
    await api("POST", `/entries/${frenchBread.json().id}/publish`);
    await createRecipe({ title: "Toast", related: [draft, bread], method: "1. *Toast* it" });

    const toast = await server.inject({ method: "GET", url: "/delivery/recipes/toast" });
    const toastInFrench = await api("POST", `/entries/${toast.json().id}/translations`, {
      locale: "fr-FR",
    });
    await api("POST", `/entries/${toastInFrench.json().id}/publish`);
    const french = await server.inject({
      method: "GET",
      url: "/delivery/recipes/toast?locale=fr-FR",
    });

    expect(toast.json().data).toEqual({
      title: "Toast",
      related: [
        {
          id: bread,
          title: "Bread",
          slug: "bread",
          url: "/recipes/bread",
          collection: "recipes",
          locale: "en-GB",
        },
      ],
      method: { markdown: "1. *Toast* it", html: "<ol>\n<li><em>Toast</em> it</li>\n</ol>\n" },
    });
    expect(french.json().data.related).toEqual([
      expect.objectContaining({ id: frenchBread.json().id, title: "Pain", locale: "fr-FR" }),
    ]);
  });

  it("forgets a deleted entry wherever it was chosen", async () => {
    const bread = await createRecipe({ title: "Bread" });
    const toast = await createRecipe({ title: "Toast", related: [bread] });

    await api("DELETE", `/entries/${bread}`);

    const saved = (await api("GET", `/entries/${toast}`)).json();
    expect(saved.data.related).toEqual([]);
    expect(
      (await api("PATCH", `/entries/${toast}`, { data: { title: "Hot toast" } })).statusCode,
    ).toBe(200);
  });

  it("keeps collection handles the delivery API uses for itself", async () => {
    const response = await api("POST", "/collections", {
      handle: "globals",
      name: "Globals",
      blueprintHandle: "recipe",
      structure: "flat",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain("“globals” is used by Lintel itself");
  });
});
