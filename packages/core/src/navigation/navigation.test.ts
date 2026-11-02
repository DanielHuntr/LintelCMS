import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensurePagesCollection } from "../collections/default-collections.js";
import { useTestDatabase } from "../testing/test-database.js";
import { createHomePage } from "../testing/test-home-page.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { ensureMainMenu } from "./default-navigation.js";
import { findNavigationProblems } from "./navigation-items.js";
import type { NavigationItem } from "./navigation.schema.js";

function item(changes: Partial<NavigationItem> = {}): NavigationItem {
  return {
    id: randomUUID(),
    label: "",
    entryId: null,
    url: null,
    newTab: false,
    children: [],
    ...changes,
  };
}

describe("the rules for a menu's items", () => {
  it("says what is wrong with each item, by id", () => {
    const empty = item({ label: "Nothing" });
    const both = item({ url: "/a", entryId: randomUUID(), label: "Both" });
    const unlabelled = item({ url: "https://example.com" });
    const tooDeep = item({ url: "/deep", label: "Deep" });
    const parent = item({ url: "/shop", label: "Shop", children: [tooDeep] });

    expect(findNavigationProblems([empty, both, unlabelled, parent], 1)).toEqual({
      [empty.id]: "Choose a page or type an address for this item",
      [both.id]: "An item can link to a page or an address, not both",
      [unlabelled.id]: "Give this item a label",
      [tooDeep.id]: "This menu has one level, so items can't go inside other items",
    });
    expect(findNavigationProblems([parent], 2)).toEqual({});
  });
});

describe("navigation menus", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let api: SendRequest;

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase);
    await ensurePagesCollection(testDatabase.database);
    await ensureMainMenu(testDatabase.database);
    await createTestUser(testDatabase.database, "ana@example.com", [["*"]]);
    api = requestsAs(server, await signInAndGetCookies(server, "ana@example.com"));
  });

  afterEach(() => server.close());

  function deliver(url: string) {
    return server.inject({ method: "GET", url });
  }

  async function createPage(title: string, publish = true): Promise<string> {
    const page = await api("POST", "/collections/pages/entries", { data: { title } });
    if (publish) {
      await api("POST", `/entries/${page.json().id}/publish`);
    }
    return page.json().id;
  }

  it("starts every site with an empty main menu, and makes more", async () => {
    await ensureMainMenu(testDatabase.database);
    const footer = await api("POST", "/navigation", {
      handle: "footer",
      name: "Footer",
      maxDepth: 1,
    });
    const taken = await api("POST", "/navigation", { handle: "footer", name: "Again" });

    expect(footer.statusCode).toBe(201);
    expect(footer.json()).toMatchObject({ handle: "footer", maxDepth: 1, items: [] });
    expect(taken.json().code).toBe("NAVIGATION_HANDLE_TAKEN");
    expect((await api("GET", "/navigation")).json().navigations).toEqual([
      expect.objectContaining({ handle: "footer", itemCount: 0 }),
      expect.objectContaining({ handle: "main", name: "Main menu", maxDepth: 2, itemCount: 0 }),
    ]);
  });

  it("saves a tree of items, with the entries they link to", async () => {
    const aboutId = await createPage("About us");
    const about = item({ entryId: aboutId });
    const shop = item({
      label: "Shop",
      url: "https://shop.example.com",
      newTab: true,
      children: [item({ label: "Gift cards", url: "/gift-cards" })],
    });

    const saved = await api("PUT", "/navigation/main", { items: [about, shop] });

    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toMatchObject({
      itemCount: 3,
      items: [about, shop],
      linkedEntries: {
        [aboutId]: { title: "About us", collectionHandle: "pages", status: "published" },
      },
    });
  });

  it("refuses items that break the menu's rules, saying which", async () => {
    const deep = item({ label: "Deep", url: "/deep" });
    const missing = item({ entryId: randomUUID() });
    const tooDeep = item({
      label: "Top",
      url: "/top",
      children: [item({ label: "Middle", url: "/middle", children: [deep] })],
    });

    const response = await api("PUT", "/navigation/main", { items: [tooDeep, missing] });

    expect(response.statusCode).toBe(400);
    expect(response.json().fields).toEqual({
      [deep.id]: "This menu has 2 levels, so items can't go any deeper",
      [missing.id]: "The page this item linked to has been deleted",
    });
    expect((await api("GET", "/navigation/main")).json().items).toEqual([]);
  });

  it("delivers addresses ready to print, leaving out pages that aren't live", async () => {
    await api("POST", "/locales", { code: "fr-FR" });
    await createHomePage(api, ["fr-FR"]);
    const aboutId = await createPage("About us");
    const draftId = await createPage("Secret", false);
    const french = await api("POST", `/entries/${aboutId}/translations`, { locale: "fr-FR" });
    await api("PATCH", `/entries/${french.json().id}`, {
      data: { title: "À propos" },
      slug: "a-propos",
    });
    await api("POST", `/entries/${french.json().id}/publish`);
    await api("PUT", "/navigation/main", {
      items: [
        item({ entryId: aboutId, children: [item({ label: "Team", url: "/about-us#team" })] }),
        item({ entryId: draftId, children: [item({ label: "Hidden", url: "/hidden" })] }),
        item({ label: "Contact", url: "mailto:hello@example.com" }),
      ],
    });

    const english = await deliver("/delivery/navigation/main");
    const inFrench = await deliver("/delivery/navigation/main?locale=fr-FR");

    expect(english.headers["cache-control"]).toBe("public, max-age=60");
    expect(english.json()).toEqual({
      handle: "main",
      name: "Main menu",
      locale: "en-GB",
      items: [
        {
          label: "About us",
          url: "/about-us",
          newTab: false,
          style: "link",
          entryId: aboutId,
          children: [
            {
              label: "Team",
              url: "/about-us#team",
              newTab: false,
              style: "link",
              entryId: null,
              children: [],
            },
          ],
        },
        {
          label: "Contact",
          url: "mailto:hello@example.com",
          newTab: false,
          style: "link",
          entryId: null,
          children: [],
        },
      ],
    });
    expect(inFrench.json().items[0]).toMatchObject({
      label: "À propos",
      url: "/a-propos",
      entryId: french.json().id,
    });
  });

  it("keeps menus to people who may change them", async () => {
    await createTestUser(testDatabase.database, "reader@example.com", [["navigation:read"]]);
    const reader = requestsAs(server, await signInAndGetCookies(server, "reader@example.com"));

    expect((await reader("GET", "/navigation/main")).statusCode).toBe(200);
    expect((await reader("PUT", "/navigation/main", { items: [] })).statusCode).toBe(403);
    expect((await reader("DELETE", "/navigation/main")).statusCode).toBe(403);
    expect((await api("DELETE", "/navigation/main")).statusCode).toBe(204);
  });
});
