import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensurePagesCollection } from "../collections/default-collections.js";
import { ensureSiteSettings } from "../globals/default-globals.js";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { buildSiteServer } from "../website/site-server.js";
import { ensureMainMenu } from "./default-navigation.js";

/**
 * The journey from the admin to the website, as the admin makes the calls: create About
 * under Home with "In the main menu" on, publish it, view the page, and the header links to
 * it. Then the menu follows the page tree instead, and a new page shows up by itself.
 */
const JOURNEY_TIMEOUT = 60_000;

describe("putting a page in the main menu, all the way to the website", () => {
  const testDatabase = useTestDatabase();
  let api: FastifyInstance;
  let site: FastifyInstance;
  let owner: SendRequest;

  beforeEach(async () => {
    api = await startTestServer(testDatabase.activeDatabase, {
      website: { builtInSiteUrl: "http://localhost:3997" },
    });
    site = buildSiteServer({ api });
    await site.ready();
    await ensurePagesCollection(testDatabase.database);
    await ensureSiteSettings(testDatabase.database);
    await ensureMainMenu(testDatabase.database);
    await createTestUser(testDatabase.database, "owner@example.com", [["*"]]);
    owner = requestsAs(api, await signInAndGetCookies(api, "owner@example.com"));
  });

  afterEach(async () => {
    await site.close();
    await api.close();
  });

  async function createPage(title: string, parentId: string | null): Promise<string> {
    const created = await owner("POST", "/collections/pages/entries", {
      data: { title },
      parentId,
    });
    expect(created.statusCode, created.body).toBe(201);
    await owner("POST", `/entries/${created.json().id}/publish`);
    return created.json().id;
  }

  const headerOf = async (path: string) => {
    const page = await site.inject({ method: "GET", url: path });
    expect(page.statusCode, page.body.slice(0, 500)).toBe(200);
    return /<header[\s\S]*?<\/header>/.exec(page.body)?.[0] ?? "";
  };

  it(
    "shows About in the header once it is in the main menu",
    async () => {
      const homeId = await createPage("Home", null);
      const aboutId = await createPage("About", homeId);
      expect(await headerOf("/")).not.toContain(">About<");

      const switched = await owner("PUT", `/navigation/main/pages/${aboutId}`, { inMenu: true });
      expect(switched.json().inMenu).toBe(true);

      const header = await headerOf("/about");
      expect(header).toContain('href="/about"');
      expect(header).toContain(">About<");
      expect(header).toContain('aria-current="page"');

      await owner("PUT", "/navigation/main", { source: "pageTree" });
      await createPage("Contact", homeId);
      expect(await headerOf("/")).toContain(">Contact<");
    },
    JOURNEY_TIMEOUT,
  );
});
