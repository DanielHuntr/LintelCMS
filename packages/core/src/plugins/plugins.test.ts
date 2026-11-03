import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildServer } from "../server.js";
import { useTestDatabase } from "../testing/test-database.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";

describe("plugins", () => {
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

  function updatePlugins(enabled: unknown, cookies = adminCookies) {
    return server.inject({ method: "PUT", url: "/plugins", payload: { enabled }, cookies });
  }

  it("lists every plugin, all switched off on a fresh install", async () => {
    const response = await server.inject({ method: "GET", url: "/plugins", cookies: adminCookies });

    expect(response.statusCode).toBe(200);
    const plugins = response.json().plugins;
    expect(plugins.map((plugin: { id: string }) => plugin.id)).toEqual([
      "blog",
      "commerce",
      "forms",
      "automations",
      "seo",
      "free-photos",
      "drafts",
      "experiments",
    ]);
    expect(plugins[0]).toEqual({
      id: "blog",
      name: "Blog",
      description: "Posts, categories and tags.",
      enabled: false,
      source: "built-in",
      version: null,
      permissions: [],
      hasSettings: false,
    });
    expect(plugins.every((plugin: { enabled: boolean }) => !plugin.enabled)).toBe(true);
  });

  it("switches on exactly the plugins listed, and off again", async () => {
    const enabled = await updatePlugins(["seo", "commerce", "seo"]);

    expect(enabled.statusCode).toBe(200);
    const enabledIds = enabled
      .json()
      .plugins.filter((plugin: { enabled: boolean }) => plugin.enabled)
      .map((plugin: { id: string }) => plugin.id);
    expect(enabledIds).toEqual(["commerce", "seo"]);

    const me = await server.inject({ method: "GET", url: "/auth/me", cookies: adminCookies });
    expect(me.json().enabledPlugins).toEqual(["commerce", "seo"]);

    const disabled = await updatePlugins(["seo"]);
    expect(
      disabled.json().plugins.map((plugin: { id: string; enabled: boolean }) => plugin.enabled),
    ).toEqual([false, false, false, false, true, false, false, false]);
    const signIn = await server.inject({
      method: "POST",
      url: "/auth/sign-in",
      payload: { email: "admin@example.com", password: "a long and memorable password" },
    });
    expect(signIn.json().enabledPlugins).toEqual(["seo"]);
  });

  it("rejects a plugin that doesn't exist, and changes nothing", async () => {
    await updatePlugins(["blog"]);

    const response = await updatePlugins(["blog", "time-machine"]);

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: "INVALID_REQUEST" });
    expect(response.json().message).toContain('There is no plugin called "time-machine"');
    const me = await server.inject({ method: "GET", url: "/auth/me", cookies: adminCookies });
    expect(me.json().enabledPlugins).toEqual(["blog"]);

    expect((await updatePlugins("blog")).statusCode).toBe(400);
  });

  it("needs settings:read to see plugins and settings:update to change them", async () => {
    await createTestUser(testDatabase.database, "reader@example.com", [["settings:read"]]);
    await createTestUser(testDatabase.database, "editor@example.com", [["entries:*"]]);
    const readerCookies = await signInAndGetCookies(server, "reader@example.com");
    const editorCookies = await signInAndGetCookies(server, "editor@example.com");

    const signedOut = await server.inject({ method: "GET", url: "/plugins" });
    const editorList = await server.inject({
      method: "GET",
      url: "/plugins",
      cookies: editorCookies,
    });
    const readerList = await server.inject({
      method: "GET",
      url: "/plugins",
      cookies: readerCookies,
    });
    const readerUpdate = await updatePlugins(["blog"], readerCookies);

    expect(signedOut.statusCode).toBe(401);
    expect(editorList.statusCode).toBe(403);
    expect(readerList.statusCode).toBe(200);
    expect(readerUpdate.statusCode).toBe(403);
    expect(readerUpdate.json().message).toContain("settings:update");
  });
});
