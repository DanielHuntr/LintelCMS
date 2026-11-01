import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildServer } from "../server.js";
import { useTestDatabase } from "../testing/test-database.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";

describe('the "What are you building?" step', () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let adminCookies: Record<string, string>;

  beforeEach(async () => {
    server = buildServer({
      adminOrigin: "http://localhost:5173",
      database: testDatabase.activeDatabase,
    });
    await server.ready();
    await createTestUser(testDatabase.database, "admin@example.com", [["*"]]);
    adminCookies = await signInAndGetCookies(server, "admin@example.com");
  });

  afterEach(() => server.close());

  function setUpSite(payload: object, cookies = adminCookies) {
    return server.inject({ method: "POST", url: "/setup/site", payload, cookies });
  }

  async function siteSetupCompleted(): Promise<boolean> {
    const status = await server.inject({ method: "GET", url: "/setup/status" });
    return status.json().siteSetupCompleted;
  }

  it("saves the kind of site, switches on its plugins and marks the step done", async () => {
    expect(await siteSetupCompleted()).toBe(false);

    const response = await setUpSite({ siteType: "shop", plugins: ["commerce", "seo"] });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.siteType).toBe("shop");
    expect(body.plugins).toHaveLength(5);
    expect(body.plugins.filter((plugin: { enabled: boolean }) => plugin.enabled)).toEqual([
      {
        id: "commerce",
        name: "Online shop",
        description: "Products, orders and payments.",
        enabled: true,
      },
      {
        id: "seo",
        name: "SEO tools",
        description: "Page titles, sitemaps and redirects.",
        enabled: true,
      },
    ]);
    expect(await siteSetupCompleted()).toBe(true);
  });

  it("can be run again later to change the choice", async () => {
    await setUpSite({ siteType: "shop", plugins: ["commerce"] });

    const response = await setUpSite({ siteType: "blog", plugins: ["blog"] });

    expect(response.statusCode).toBe(200);
    expect(response.json().siteType).toBe("blog");
    const me = await server.inject({ method: "GET", url: "/auth/me", cookies: adminCookies });
    expect(me.json().enabledPlugins).toEqual(["blog"]);
  });

  it("checks the site type and plugins, and changes nothing when they're wrong", async () => {
    const response = await setUpSite({ siteType: "casino", plugins: ["roulette"] });

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain("The site type should be one of");
    expect(response.json().message).toContain('There is no plugin called "roulette"');
    expect(await siteSetupCompleted()).toBe(false);
  });

  it("needs a signed-in user with settings:update", async () => {
    await createTestUser(testDatabase.database, "reader@example.com", [["settings:read"]]);
    const readerCookies = await signInAndGetCookies(server, "reader@example.com");
    const payload = { siteType: "blank", plugins: [] };

    expect((await server.inject({ method: "POST", url: "/setup/site", payload })).statusCode).toBe(
      401,
    );
    expect((await setUpSite(payload, readerCookies)).statusCode).toBe(403);
    expect(await siteSetupCompleted()).toBe(false);
  });
});
