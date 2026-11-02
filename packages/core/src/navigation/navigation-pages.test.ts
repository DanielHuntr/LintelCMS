import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensurePagesCollection } from "../collections/default-collections.js";
import { useTestDatabase } from "../testing/test-database.js";
import { createHomePage } from "../testing/test-home-page.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { ensureMainMenu } from "./default-navigation.js";
import { buildPageTreeItems } from "./navigation-page-tree.js";
import type { NavigationItem } from "./navigation.schema.js";
import { addPageItem, removePageItems } from "./page-menu-items.js";

const settings = { includeHome: true, hiddenEntryIds: [], labels: {} };

describe("a menu that follows the page tree", () => {
  const pages = [
    { id: "home", parentId: null, sortOrder: 0 },
    { id: "contact", parentId: "home", sortOrder: 2 },
    { id: "about", parentId: "home", sortOrder: 1 },
    { id: "team", parentId: "about", sortOrder: 0 },
    { id: "people", parentId: "team", sortOrder: 0 },
  ];
  const shape = (items: readonly NavigationItem[]): unknown =>
    items.map((item) => [item.entryId, ...(item.children.length ? [shape(item.children)] : [])]);

  it("lists Home, then the pages under it in tree order, as deep as the menu goes", () => {
    expect(shape(buildPageTreeItems(pages, "home", settings, 2))).toEqual([
      ["home"],
      ["about", [["team"]]],
      ["contact"],
    ]);
    expect(shape(buildPageTreeItems(pages, "home", settings, 1))).toEqual([
      ["home"],
      ["about"],
      ["contact"],
    ]);
  });

  it("leaves out hidden pages with everything under them, and uses labels of their own", () => {
    const items = buildPageTreeItems(
      pages,
      "home",
      { includeHome: false, hiddenEntryIds: ["about"], labels: { contact: "Say hello" } },
      3,
    );
    expect(shape(items)).toEqual([["contact"]]);
    expect(items[0]?.label).toBe("Say hello");
  });

  it("is empty until the site has a home page", () => {
    expect(buildPageTreeItems(pages, null, settings, 2)).toEqual([]);
  });
});

describe("putting a page in a hand-made menu", () => {
  const link = (entryId: string, children: NavigationItem[] = []): NavigationItem => ({
    id: randomUUID(),
    label: "",
    entryId,
    url: null,
    newTab: false,
    children,
  });

  it("goes beside its siblings in the tree's order, before buttons", () => {
    const button: NavigationItem = { ...link("x"), entryId: null, url: "/book", style: "button" };
    const items = [link("home"), link("contact"), button];
    const added = addPageItem(
      items,
      {
        entryId: "about",
        parentId: "home",
        isUnderHome: true,
        siblingIds: ["about", "contact"],
      },
      "",
      2,
    );
    expect(added.map((item) => item.entryId ?? item.url)).toEqual([
      "home",
      "about",
      "contact",
      "/book",
    ]);
  });

  it("goes under its parent's item, unless the menu has no level for it", () => {
    const place = { entryId: "team", parentId: "about", isUnderHome: false, siblingIds: ["team"] };
    const nested = addPageItem([link("about")], place, "Our team", 2);
    expect(nested[0]?.children[0]).toMatchObject({ entryId: "team", label: "Our team" });
    const flat = addPageItem([link("about")], place, "", 1);
    expect(flat.map((item) => item.entryId)).toEqual(["about", "team"]);
  });

  it("keeps what was inside a removed page's item", () => {
    const items = [link("about", [link("team")])];
    expect(removePageItems(items, "about").map((item) => item.entryId)).toEqual(["team"]);
  });
});

describe("“In the main menu” on a page", () => {
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

  async function createPage(title: string, parentId: string | null): Promise<string> {
    const page = await api("POST", "/collections/pages/entries", { data: { title }, parentId });
    await api("POST", `/entries/${page.json().id}/publish`);
    return page.json().id;
  }

  const delivered = async () =>
    (await server.inject({ method: "GET", url: "/delivery/navigation/main" })).json().items as {
      label: string;
      url: string;
      children: { label: string }[];
    }[];

  it("adds and removes the page in the main menu the Menus screen shows", async () => {
    const homeId = await createHomePage(api);
    await api("POST", `/entries/${homeId}/publish`);
    const aboutId = await createPage("About", homeId);
    const teamId = await createPage("Team", aboutId);

    const on = await api("PUT", `/navigation/main/pages/${aboutId}`, { inMenu: true });
    await api("PUT", `/navigation/main/pages/${teamId}`, { inMenu: true, label: "Our team" });

    expect(on.json()).toMatchObject({ inMenu: true, label: "", menu: { source: "items" } });
    expect(await delivered()).toEqual([
      expect.objectContaining({
        label: "About",
        url: "/about",
        children: [expect.objectContaining({ label: "Our team", url: "/about/team" })],
      }),
    ]);
    const menu = (await api("GET", "/navigation/main")).json();
    expect(menu.items[0].entryId).toBe(aboutId);

    const off = await api("PUT", `/navigation/main/pages/${aboutId}`, { inMenu: false });
    expect(off.json().inMenu).toBe(false);
    expect((await delivered()).map((item) => item.label)).toEqual(["Our team"]);
    expect((await api("GET", `/navigation/main/pages/${teamId}`)).json()).toMatchObject({
      inMenu: true,
      label: "Our team",
    });
  });

  it("follows the page tree: hiding, labels and the menu's levels", async () => {
    const homeId = await createHomePage(api);
    await api("POST", `/entries/${homeId}/publish`);
    const aboutId = await createPage("About", homeId);
    await createPage("Team", aboutId);
    const contactId = await createPage("Contact", homeId);
    await api("PUT", "/navigation/main", { source: "pageTree" });

    expect((await delivered()).map((item) => item.label)).toEqual(["Home", "About", "Contact"]);
    expect((await delivered())[1]?.children.map((child) => child.label)).toEqual(["Team"]);

    await api("PUT", `/navigation/main/pages/${aboutId}`, { inMenu: false });
    await api("PUT", `/navigation/main/pages/${contactId}`, { inMenu: true, label: "Say hi" });
    await api("PUT", "/navigation/main", { maxDepth: 1 });

    expect((await delivered()).map((item) => item.label)).toEqual(["Home", "Say hi"]);
    const menu = (await api("GET", "/navigation/main")).json();
    expect(menu).toMatchObject({ source: "pageTree", pageTree: { hiddenEntryIds: [aboutId] } });
    expect(menu.linkedEntries[aboutId].title).toBe("About");

    // Back to a hand-made menu: the editor sends the items it showed, which are kept.
    const back = await api("PUT", "/navigation/main", { source: "items", items: menu.items });
    expect(back.json().items.map((item: NavigationItem) => item.entryId)).toEqual([
      homeId,
      contactId,
    ]);
  });

  it("is only for pages, and only for people who may change menus", async () => {
    await createTestUser(testDatabase.database, "reader@example.com", [["navigation:read"]]);
    const reader = requestsAs(server, await signInAndGetCookies(server, "reader@example.com"));
    const homeId = await createHomePage(api);

    expect(
      (await reader("PUT", `/navigation/main/pages/${homeId}`, { inMenu: true })).statusCode,
    ).toBe(403);
    expect((await api("GET", `/navigation/main/pages/${randomUUID()}`)).statusCode).toBe(404);
  });

  it("gives each site its own main menu", async () => {
    const site = await api("POST", "/sites", {
      handle: "shop",
      name: "Shop",
      hostnames: ["shop.example.com"],
      defaultLocale: "en-GB",
    });
    expect(site.statusCode).toBe(201);
    const shop = requestsAs(server, await signInAndGetCookies(server, "ana@example.com"), {
      "lintel-site": "shop",
    });
    const shopHome = await shop("POST", "/collections/pages/entries", {
      data: { title: "Shop home" },
    });

    await shop("PUT", `/navigation/main/pages/${shopHome.json().id}`, { inMenu: true });

    expect((await shop("GET", "/navigation/main")).json().items).toHaveLength(1);
    expect((await api("GET", "/navigation/main")).json().items).toHaveLength(0);
  });
});
