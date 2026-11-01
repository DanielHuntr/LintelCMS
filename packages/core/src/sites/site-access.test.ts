import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensurePagesCollection } from "../collections/default-collections.js";
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
});
