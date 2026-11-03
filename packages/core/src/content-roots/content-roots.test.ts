import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensurePagesCollection } from "../collections/default-collections.js";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";

describe("site starts: pages at the top of the tree", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let api: SendRequest;

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase);
    await ensurePagesCollection(testDatabase.database);
    await createTestUser(testDatabase.database, "ana@example.com", [["*"]]);
    api = requestsAs(server, await signInAndGetCookies(server, "ana@example.com"));
  });

  afterEach(() => server.close());

  async function create(collection: string, title: string, parentId?: string): Promise<string> {
    const response = await api("POST", `/collections/${collection}/entries`, {
      data: { title },
      parentId,
    });
    expect(response.statusCode, response.body).toBe(201);
    return response.json().id;
  }

  async function publish(entryId: string): Promise<void> {
    const response = await api("POST", `/entries/${entryId}/publish`);
    expect(response.statusCode, response.body).toBe(200);
  }

  async function addressOf(entryId: string): Promise<string | null> {
    const response = await api("GET", `/content-tree/entries/${entryId}/info`);
    expect(response.statusCode, response.body).toBe(200);
    return response.json().url;
  }

  /** Landing pages may only go under pages; their own content type keeps them off the top. */
  async function addLandingPages(): Promise<void> {
    await api("POST", "/blueprints", {
      handle: "landing_page",
      name: "Landing page",
      fields: [{ handle: "title", label: "Title", type: "text" }],
    });
    const created = await api("POST", "/collections", {
      handle: "landing_pages",
      name: "Landing pages",
      blueprintHandle: "landing_page",
      structure: "tree",
      routePattern: "/{slug}",
      allowedAtRoot: false,
      allowedChildren: [],
    });
    expect(created.statusCode, created.body).toBe(201);
    await api("PUT", "/collections/pages", { allowedChildren: ["pages", "landing_pages"] });
  }

  it("offers and allows only content types allowed at the top, checked by the server", async () => {
    await addLandingPages();

    const atTop = await api("GET", "/content-tree/allowed-types");
    expect(atTop.json().types.map((type: { handle: string }) => type.handle)).toEqual(["pages"]);

    const refused = await api("POST", "/collections/landing_pages/entries", {
      data: { title: "Spring offer" },
    });
    expect(refused.statusCode).toBe(400);
    expect(refused.json().code).toBe("PLACEMENT_NOT_ALLOWED");

    const home = await create("pages", "Home");
    const shop = await create("pages", "Shop");
    const tree = (await api("GET", "/content-tree")).json();
    expect(tree.siteStartCount).toBe(2);
    const top = (await api("GET", "/content-tree/children?collection=pages")).json().items;
    expect(
      top.map((node: { id: string; isSiteStart: boolean }) => [node.id, node.isSiteStart]),
    ).toEqual([
      [home, true],
      [shop, true],
    ]);
  });

  it("starts with no site start, so the admin can offer to create the home page", async () => {
    expect((await api("GET", "/content-tree")).json().siteStartCount).toBe(0);
  });

  it("builds addresses from the site starts: / for the first, its slug for the others", async () => {
    const home = await create("pages", "Home");
    const about = await create("pages", "About", home);
    const team = await create("pages", "Team", about);
    const shop = await create("pages", "Shop");
    const boots = await create("pages", "Boots", shop);

    expect(await addressOf(home)).toBe("/");
    expect(await addressOf(about)).toBe("/about");
    expect(await addressOf(team)).toBe("/about/team");
    expect(await addressOf(shop)).toBe("/shop");
    expect(await addressOf(boots)).toBe("/shop/boots");

    const info = (await api("GET", `/content-tree/entries/${home}/info`)).json();
    expect(info.urls).toEqual(["/"]);
    expect(info.siteStart).toEqual({
      isDefault: true,
      isAssigned: false,
      hostname: "",
      pathPrefix: "",
    });
    expect((await api("GET", `/content-tree/entries/${about}/info`)).json().siteStart).toBeNull();

    // The delivery API gives the same addresses.
    await publish(shop);
    await publish(boots);
    const delivered = (await api("GET", "/delivery/pages/boots")).json();
    expect(delivered.url).toBe("/shop/boots");
  });

  // LINTEL-FUNC-018: sections went by name, so a page tree called "Archive" took "/".
  it("keeps / on the first page tree made, whatever the content types are called", async () => {
    await api("POST", "/blueprints", {
      handle: "archive_page",
      name: "Archive page",
      fields: [{ handle: "title", label: "Title", type: "text" }],
    });
    const archives = await api("POST", "/collections", {
      handle: "archive",
      name: "Archive",
      blueprintHandle: "archive_page",
      structure: "tree",
      routePattern: "/{slug}",
      allowedAtRoot: true,
      allowedChildren: [],
    });
    expect(archives.statusCode, archives.body).toBe(201);
    const home = await create("pages", "Home");
    const old = await create("archive", "Old news");

    expect(await addressOf(home)).toBe("/");
    expect(await addressOf(old)).toBe("/old-news");

    await api("PUT", "/collections/pages", { name: "Website" });
    expect(await addressOf(home)).toBe("/");
    const sections = (await api("GET", "/content-tree")).json().roots;
    expect(sections.map((section: { name: string }) => section.name).slice(0, 2)).toEqual([
      "Website",
      "Archive",
    ]);
  });

  it("uses a domain or path prefix from Hostnames, and refuses one already in use", async () => {
    const home = await create("pages", "Home");
    const shop = await create("pages", "Shop");
    const boots = await create("pages", "Boots", shop);

    const before = (await api("GET", `/content-tree/entries/${shop}/hostnames`)).json();
    expect(before).toMatchObject({ hostname: "", pathPrefix: "", isAssigned: false, url: "/shop" });

    const saved = await api("PUT", `/content-tree/entries/${shop}/hostnames`, {
      hostname: "https://Shop.Example.com/",
      pathPrefix: "",
    });
    expect(saved.statusCode, saved.body).toBe(200);
    expect(saved.json()).toMatchObject({
      hostname: "shop.example.com",
      isAssigned: true,
      url: "https://shop.example.com/",
    });
    expect(await addressOf(boots)).toBe("https://shop.example.com/boots");

    await api("PUT", `/content-tree/entries/${shop}/hostnames`, { pathPrefix: "store/" });
    expect(await addressOf(boots)).toBe("/store/boots");

    const clash = await api("PUT", `/content-tree/entries/${home}/hostnames`, {
      pathPrefix: "/store",
    });
    expect(clash.statusCode).toBe(409);
    expect(clash.json().message).toContain("“Shop” already uses /store");

    const notPath = await api("PUT", `/content-tree/entries/${home}/hostnames`, {
      pathPrefix: "my shop",
    });
    expect(notPath.statusCode).toBe(400);

    const notAStart = await api("PUT", `/content-tree/entries/${boots}/hostnames`, {
      pathPrefix: "/boots",
    });
    expect(notAStart.statusCode).toBe(400);
    expect(notAStart.json().code).toBe("NOT_A_SITE_START");

    // Both empty: back to the default.
    await api("PUT", `/content-tree/entries/${shop}/hostnames`, { hostname: "", pathPrefix: "" });
    expect(await addressOf(boots)).toBe("/shop/boots");
  });

  it("lets only people who can change settings give a page a domain", async () => {
    const home = await create("pages", "Home");
    await createTestUser(testDatabase.database, "ed@example.com", [
      ["entries:read", "entries:update"],
    ]);
    const editor = requestsAs(server, await signInAndGetCookies(server, "ed@example.com"));

    expect((await editor("GET", `/content-tree/entries/${home}/hostnames`)).statusCode).toBe(200);
    const refused = await editor("PUT", `/content-tree/entries/${home}/hostnames`, {
      pathPrefix: "/home",
    });
    expect(refused.statusCode).toBe(403);
  });

  it("moves a page to the top and back, with the placement rules and new addresses", async () => {
    await addLandingPages();
    const home = await create("pages", "Home");
    const about = await create("pages", "About", home);
    const team = await create("pages", "Team", about);
    const offer = await create("landing_pages", "Spring offer", home);
    await publish(home);
    await publish(about);
    await publish(team);

    // To the top: About becomes a site start of its own at "/about", so the addresses
    // that follow the tree stay as they were.
    const moved = await api("POST", "/content-tree/move", {
      entryId: about,
      parentId: null,
      index: 1,
    });
    expect(moved.statusCode, moved.body).toBe(200);
    expect(moved.json().previous).toEqual({ parentId: home, index: 0 });
    expect(moved.json().addressChanges).toEqual([]);
    expect(await addressOf(about)).toBe("/about");
    expect(await addressOf(team)).toBe("/about/team");

    // Landing pages aren't allowed at the top, whichever way they get there.
    const refused = await api("POST", "/content-tree/move", {
      entryId: offer,
      parentId: null,
      index: 0,
    });
    expect(refused.statusCode).toBe(400);
    expect(refused.json().code).toBe("PLACEMENT_NOT_ALLOWED");

    // Above Home, About is the first site start, so it becomes "/" and Home "/home".
    const first = (
      await api("POST", "/content-tree/move", { entryId: about, parentId: null, index: 0 })
    ).json();
    expect(first.addressChanges).toEqual(
      expect.arrayContaining([
        { entryId: about, title: "About", from: "/about", to: "/" },
        { entryId: home, title: "Home", from: "/", to: "/home" },
        { entryId: team, title: "Team", from: "/about/team", to: "/team" },
      ]),
    );

    // And back under Home: everything returns to where it was.
    const back = (
      await api("POST", "/content-tree/move", { entryId: about, parentId: home, index: 0 })
    ).json();
    expect(back.addressChanges).toHaveLength(3);
    expect(await addressOf(home)).toBe("/");
    expect(await addressOf(about)).toBe("/about");
    expect(await addressOf(team)).toBe("/about/team");
  });

  it("follows the tree by default, with a route pattern as the override", async () => {
    await addLandingPages();
    const home = await create("pages", "Home");
    const about = await create("pages", "About", home);
    const team = await create("pages", "Team", about);
    const history = await create("pages", "Our history", team);
    // Landing pages use "/{slug}": wherever they sit, the address is the slug alone.
    const offer = await create("landing_pages", "Spring offer", about);

    expect(await addressOf(team)).toBe("/about/team");
    expect(await addressOf(history)).toBe("/about/team/our-history");
    expect(await addressOf(offer)).toBe("/spring-offer");

    // Pages can be given a flat pattern too.
    await api("PUT", "/collections/pages", { routePattern: "/{slug}" });
    expect(await addressOf(history)).toBe("/our-history");

    // A pattern needs exactly one of {slug} and {path}.
    const both = await api("PUT", "/collections/pages", { routePattern: "/{path}/{slug}" });
    expect(both.statusCode).toBe(400);
  });

  it("offers redirects when sorting the top makes another page /", async () => {
    const home = await create("pages", "Home");
    const shop = await create("pages", "Shop");
    const boots = await create("pages", "Boots", shop);
    await publish(home);
    await publish(shop);
    await publish(boots);

    const sorted = await api("POST", "/content-tree/sort", {
      parentId: null,
      collection: "pages",
      order: [shop, home],
    });

    expect(sorted.statusCode, sorted.body).toBe(200);
    expect(sorted.json().addressChanges).toEqual(
      expect.arrayContaining([
        { entryId: shop, title: "Shop", from: "/shop", to: "/" },
        { entryId: boots, title: "Boots", from: "/shop/boots", to: "/boots" },
        { entryId: home, title: "Home", from: "/", to: "/home" },
      ]),
    );
    expect(sorted.json().addressChanges).toHaveLength(3);
  });

  it("adds redirects from the old addresses after a move, and suggests them meanwhile", async () => {
    await api("PUT", "/plugins", { enabled: ["seo"] });
    const home = await create("pages", "Home");
    const shop = await create("pages", "Shop");
    const boots = await create("pages", "Boots", shop);
    await publish(home);
    await publish(shop);
    await publish(boots);

    const moved = (
      await api("POST", "/content-tree/move", { entryId: boots, parentId: home, index: 0 })
    ).json();
    expect(moved.addressChanges).toEqual([
      { entryId: boots, title: "Boots", from: "/shop/boots", to: "/boots" },
    ]);

    // The move itself only suggests a redirect, as changing a slug does.
    const suggested = (await api("GET", "/seo/redirects?status=suggested")).json().redirects;
    expect(suggested).toMatchObject([{ fromPath: "/shop/boots", toPath: "/boots" }]);

    // "Add redirects" makes it work.
    const added = await api("POST", "/seo/redirects/moved", {
      redirects: moved.addressChanges.map(
        (change: { entryId: string; from: string; to: string }) => ({
          entryId: change.entryId,
          fromPath: change.from,
          toPath: change.to,
        }),
      ),
    });
    expect(added.statusCode, added.body).toBe(200);
    expect(added.json()).toEqual({ added: 1, kept: 0 });
    const delivered = (await api("GET", "/delivery/seo-redirects")).json().redirects;
    expect(delivered).toEqual([{ from: "/shop/boots", to: "/boots", statusCode: 301 }]);

    // Moving back removes the redirect from the address the page has again.
    await api("POST", "/content-tree/move", { entryId: boots, parentId: shop, index: 0 });
    const after = (await api("GET", "/seo/redirects")).json().redirects;
    expect(after.map((redirect: { fromPath: string }) => redirect.fromPath)).toEqual(["/boots"]);
  });
});
