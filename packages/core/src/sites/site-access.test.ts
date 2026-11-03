import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensurePagesCollection } from "../collections/default-collections.js";
import { ensureBuiltInRoles } from "../roles/roles.service.js";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";

/**
 * Pierre edits the French site only: his role is limited to it. The admin can work on
 * every site, as every role can until it is limited.
 */
describe("limiting a role to some sites", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let admin: SendRequest;

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase);
    await ensurePagesCollection(testDatabase.database);
    await createTestUser(testDatabase.database, "admin@example.com", [["*"]]);
    await createTestUser(testDatabase.database, "pierre@example.com", [
      ["entries:*", "settings:read"],
    ]);
    admin = requestsAs(server, await signInAndGetCookies(server, "admin@example.com"));
    await admin("POST", "/sites", {
      handle: "france",
      name: "Acme France",
      defaultLocale: "fr-FR",
    });
  });

  afterEach(() => server.close());

  async function signInAsPierre(site?: string) {
    const cookies = await signInAndGetCookies(server, "pierre@example.com");
    return requestsAs(server, cookies, site ? { "lintel-site": site } : {});
  }

  it("lists every role with the sites it may work on", async () => {
    const response = await admin("GET", "/sites/access");

    expect(response.json().roles).toContainEqual({
      handle: "pierre@example.com-role-0",
      name: "pierre@example.com role 0",
      siteHandles: null,
    });
  });

  it("keeps someone to their sites, in lists, entries and the site switcher", async () => {
    const page = await admin("POST", "/collections/pages/entries", { data: { title: "About us" } });
    const limited = await admin("PUT", "/sites/access/pierre@example.com-role-0", {
      siteHandles: ["france"],
    });
    expect(limited.json().siteHandles).toEqual(["france"]);

    const pierreInFrance = await signInAsPierre("france");
    const pierreInUk = await signInAsPierre();

    expect((await pierreInFrance("GET", "/auth/me")).json().siteIds).toHaveLength(1);
    expect(
      (await pierreInFrance("GET", "/sites"))
        .json()
        .sites.map((site: { handle: string }) => site.handle),
    ).toEqual(["france"]);
    expect((await pierreInFrance("GET", "/collections/pages/entries")).statusCode).toBe(200);
    expect(
      (await pierreInFrance("POST", "/collections/pages/entries", { data: { title: "Accueil" } }))
        .statusCode,
    ).toBe(201);

    const refused = await pierreInUk("GET", "/collections/pages/entries");
    expect(refused.statusCode).toBe(403);
    expect(refused.json()).toMatchObject({
      code: "SITE_NOT_ALLOWED",
      message: "You don't have access to Default site. Ask an admin if you need it.",
    });
    expect((await pierreInFrance("GET", `/entries/${page.json().id}`)).statusCode).toBe(403);
    expect(
      (await pierreInFrance("PATCH", `/entries/${page.json().id}`, { data: { title: "Hacked" } }))
        .statusCode,
    ).toBe(403);
    expect((await pierreInFrance("GET", `/entries/${page.json().id}/revisions`)).statusCode).toBe(
      403,
    );
  });

  it("won't let someone copy an entry to a site they can't work on", async () => {
    await admin("PUT", "/sites/access/pierre@example.com-role-0", { siteHandles: ["france"] });
    const pierre = await signInAsPierre("france");
    const page = await pierre("POST", "/collections/pages/entries", { data: { title: "Accueil" } });

    const response = await pierre("POST", `/entries/${page.json().id}/copy-to-site`, {
      site: "default",
    });

    expect(response.statusCode).toBe(403);
  });

  it("opens a role to every site again, and refuses an empty list", async () => {
    await admin("PUT", "/sites/access/pierre@example.com-role-0", { siteHandles: ["france"] });

    const empty = await admin("PUT", "/sites/access/pierre@example.com-role-0", {
      siteHandles: [],
    });
    const reopened = await admin("PUT", "/sites/access/pierre@example.com-role-0", {
      siteHandles: null,
    });
    const pierre = await signInAsPierre();

    expect(empty.statusCode).toBe(400);
    expect(reopened.json().siteHandles).toBeNull();
    expect((await pierre("GET", "/collections/pages/entries")).statusCode).toBe(200);
  });

  it("forgets a deleted site in the roles limited to it", async () => {
    await admin("PUT", "/sites/access/pierre@example.com-role-0", {
      siteHandles: ["france", "default"],
    });
    await admin("DELETE", "/sites/france");

    const roles = (await admin("GET", "/sites/access")).json().roles;

    expect(roles).toContainEqual(expect.objectContaining({ siteHandles: ["default"] }));
  });

  it("needs settings:update to change who works on which site", async () => {
    const pierre = await signInAsPierre();

    const response = await pierre("PUT", "/sites/access/pierre@example.com-role-0", {
      siteHandles: null,
    });

    expect(response.statusCode).toBe(403);
  });

  // The content tree and recycle bin used to check only the permission, not the site.
  it("keeps someone to their sites in the content tree", async () => {
    await admin("PUT", "/plugins", { enabled: ["seo"] });
    const ukPage = (
      await admin("POST", "/collections/pages/entries", { data: { title: "About us" } })
    ).json();
    await admin("PUT", "/sites/access/pierre@example.com-role-0", { siteHandles: ["france"] });
    const pierre = await signInAsPierre("france");
    const frPage = (
      await pierre("POST", "/collections/pages/entries", { data: { title: "Accueil" } })
    ).json();
    const sites = (await admin("GET", "/sites")).json().sites as Array<{
      id: string;
      handle: string;
    }>;
    const siteId = (handle: string) => sites.find((site) => site.handle === handle)?.id;

    expect((await pierre("GET", `/content-tree?siteId=${siteId("france")}`)).statusCode).toBe(200);
    const refused = [
      await pierre(
        "GET",
        `/content-tree?siteId=${sites.find((site) => site.handle !== "france")?.id}`,
      ),
      await pierre("GET", `/content-tree/children?parentId=${ukPage.id}`),
      await pierre("GET", `/content-tree/entries/${ukPage.id}/info`),
      await pierre("POST", `/content-tree/entries/${ukPage.id}/unpublish`, {}),
      await pierre("POST", `/content-tree/entries/${ukPage.id}/duplicate`, {}),
      await pierre("POST", `/content-tree/entries/${ukPage.id}/recycle`),
      await pierre("POST", "/content-tree/move", {
        entryId: frPage.id,
        parentId: ukPage.id,
        index: 0,
      }),
      await pierre("POST", "/content-tree/bulk", { action: "recycle", entryIds: [ukPage.id] }),
      await pierre("POST", "/content-tree/bulk/summary", { entryIds: [ukPage.id] }),
      await pierre("GET", `/seo/entries/${ukPage.id}`),
      await pierre("PUT", `/seo/entries/${ukPage.id}`, { title: "Hacked" }),
    ];
    expect(refused.map((response) => response.statusCode)).toEqual(refused.map(() => 403));
    expect((await admin("GET", `/entries/${ukPage.id}`)).statusCode).toBe(200);
  });

  // LINTEL-SEC-002: global search (Ctrl K) listed other sites' titles, drafts included.
  it("keeps someone to their sites in global search", async () => {
    await admin("POST", "/collections/pages/entries", { data: { title: "Secret launch plan" } });
    const french = requestsAs(server, await signInAndGetCookies(server, "admin@example.com"), {
      "lintel-site": "france",
    });
    await french("POST", "/collections/pages/entries", { data: { title: "Secret menu du jour" } });
    await admin("PUT", "/sites/access/pierre@example.com-role-0", { siteHandles: ["france"] });

    const pierre = await signInAsPierre("france");
    const found = (await pierre("GET", "/search?q=Secret")).json();

    expect(found.entries.map((entry: { title: string }) => entry.title)).toEqual([
      "Secret menu du jour",
    ]);
  });

  it("keeps someone to their sites in the recycle bin", async () => {
    const ukPage = (
      await admin("POST", "/collections/pages/entries", { data: { title: "About us" } })
    ).json();
    await admin("PUT", "/sites/access/pierre@example.com-role-0", { siteHandles: ["france"] });
    const pierre = await signInAsPierre("france");
    const frPage = (
      await pierre("POST", "/collections/pages/entries", { data: { title: "Accueil" } })
    ).json();
    const ukItem = (await admin("POST", `/content-tree/entries/${ukPage.id}/recycle`)).json();
    expect((await pierre("POST", `/content-tree/entries/${frPage.id}/recycle`)).statusCode).toBe(
      201,
    );

    const listed = (await pierre("GET", "/recycle-bin")).json().items as Array<{ title: string }>;
    expect(listed.map((item) => item.title)).toEqual(["Accueil"]);
    expect((await pierre("POST", `/recycle-bin/${ukItem.itemId}/restore`)).statusCode).toBe(404);
    expect((await pierre("DELETE", `/recycle-bin/${ukItem.itemId}`)).statusCode).toBe(404);
    expect((await pierre("DELETE", "/recycle-bin")).json()).toEqual({ deleted: 1 });

    const left = (await admin("GET", "/recycle-bin")).json().items as Array<{ title: string }>;
    expect(left.map((item) => item.title)).toEqual(["About us"]);
  });

  // Anyone with settings:update could lift their own limit, or limit the Owner role.
  it("lets someone limited to some sites change only those, and never their own limit", async () => {
    await ensureBuiltInRoles(testDatabase.database);
    await createTestUser(testDatabase.database, "sam@example.com", [
      ["settings:*", "roles:update", "entries:*"],
    ]);
    await admin("PUT", "/sites/access/sam@example.com-role-0", { siteHandles: ["france"] });
    await admin("PUT", "/sites/access/pierre@example.com-role-0", { siteHandles: ["france"] });
    const sam = requestsAs(server, await signInAndGetCookies(server, "sam@example.com"), {
      "lintel-site": "france",
    });
    const sites = (await admin("GET", "/sites")).json().sites as Array<{ handle: string }>;
    const otherSite = sites.find((site) => site.handle !== "france")?.handle;

    const refused = [
      await sam("PUT", "/sites/access/sam@example.com-role-0", { siteHandles: null }),
      await sam("PUT", "/sites/access/sam@example.com-role-0", {
        siteHandles: ["france", otherSite],
      }),
      await sam("PUT", "/sites/access/owner", { siteHandles: ["france"] }),
      await sam("PATCH", `/sites/${otherSite}`, { name: "Not yours" }),
      await sam("DELETE", `/sites/${otherSite}`),
    ];
    expect(refused.map((response) => response.statusCode)).toEqual(refused.map(() => 403));

    const allowed = await sam("PUT", "/sites/access/pierre@example.com-role-0", {
      siteHandles: ["france"],
    });
    expect(allowed.statusCode).toBe(200);
    expect((await sam("PATCH", "/sites/france", { name: "Acme France SAS" })).statusCode).toBe(200);
  });
});
