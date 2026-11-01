import type { FastifyInstance } from "fastify";
import { pgTable, text } from "drizzle-orm/pg-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { requirePermission } from "../auth/require-permission.js";
import { defineFieldtype } from "../fieldtypes/fieldtype.js";
import { buildServer } from "../server.js";
import { useTestDatabase } from "../testing/test-database.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { PluginCatalogue } from "./plugin-catalogue.js";
import { definePlugin, type LintelPlugin } from "./plugin-definition.js";
import { InvalidPluginError } from "./plugins.errors.js";
import { pluginRegistry } from "./plugins.registry.js";

/**
 * The plugin system, through a small plugin of the kind a developer would write: a
 * permission, settings, one route, a fieldtype and content made when it is switched on.
 */
const createGreetingContent = vi.fn(async () => {});

const greetingsPlugin = definePlugin({
  id: "greetings",
  name: "Greetings",
  description: "Says hello to visitors.",
  version: "1.2.0",
  permissions: [{ permission: "greetings:read", description: "See the greeting" }],
  settings: {
    schema: z.object({ greeting: z.string().min(1, { error: "Say something" }) }),
    defaults: { greeting: "Hello" },
  },
  async routes(server, { readSettings }) {
    server.get("/greetings", { preHandler: requirePermission("greetings:read") }, async () => {
      const settings = await readSettings(server.database);
      return { message: `${settings.greeting}, visitor` };
    });
  },
  fieldtypes: [
    defineFieldtype({
      type: "greetings.mood",
      name: "Mood",
      description: "How the visitor feels.",
      optionsSchema: z.object({}),
      buildValueSchema: () => z.enum(["happy", "sad"], { error: "Pick happy or sad" }),
    }),
  ],
  createContent: createGreetingContent,
});

describe("the plugin system", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let adminCookies: Record<string, string>;

  beforeEach(async () => {
    createGreetingContent.mockClear();
    server = buildServer({
      adminOrigin: "http://localhost:5173",
      database: testDatabase.activeDatabase,
      runScheduledJobs: false,
      plugins: [greetingsPlugin],
    });
    await server.ready();
    await createTestUser(testDatabase.database, "admin@example.com", [["*"]]);
    adminCookies = await signInAndGetCookies(server, "admin@example.com");
  });

  afterEach(() => server.close());

  function request(method: "GET" | "PUT", url: string, payload?: unknown, cookies = adminCookies) {
    return server.inject({ method, url, payload: payload as object, cookies });
  }

  it("lists installed plugins after the built-in ones", async () => {
    const response = await request("GET", "/plugins");

    const plugins = response.json().plugins;
    expect(plugins.map((plugin: { id: string }) => plugin.id)).toEqual([
      "blog",
      "commerce",
      "forms",
      "seo",
      "greetings",
    ]);
    expect(plugins[4]).toEqual({
      id: "greetings",
      name: "Greetings",
      description: "Says hello to visitors.",
      enabled: false,
      source: "installed",
      version: "1.2.0",
      permissions: [{ permission: "greetings:read", description: "See the greeting" }],
      hasSettings: true,
    });
  });

  it("answers 404 PLUGIN_NOT_ENABLED from a plugin's routes until it is switched on", async () => {
    const whileOff = await request("GET", "/greetings");
    expect(whileOff.statusCode).toBe(404);
    expect(whileOff.json()).toMatchObject({ code: "PLUGIN_NOT_ENABLED" });
    expect(whileOff.json().message).toBe(
      "“Greetings” is switched off. An admin can switch it on in Settings → Features.",
    );

    await request("PUT", "/plugins", { enabled: ["greetings"] });
    const whileOn = await request("GET", "/greetings");
    expect(whileOn.statusCode).toBe(200);
    expect(whileOn.json()).toEqual({ message: "Hello, visitor" });
  });

  it("checks the plugin is on before checking permissions, so it looks the same to everyone", async () => {
    await createTestUser(testDatabase.database, "editor@example.com", [["entries:read"]]);
    const editorCookies = await signInAndGetCookies(server, "editor@example.com");

    expect((await request("GET", "/greetings", undefined, editorCookies)).statusCode).toBe(404);
    await request("PUT", "/plugins", { enabled: ["greetings"] });
    expect((await request("GET", "/greetings", undefined, editorCookies)).statusCode).toBe(403);
  });

  it("makes a plugin's content each time it is switched on, and deletes nothing when off", async () => {
    await request("PUT", "/plugins", { enabled: ["greetings"] });
    await request("PUT", "/plugins", { enabled: ["greetings", "blog"] });
    expect(createGreetingContent).toHaveBeenCalledTimes(1);

    await request("PUT", "/plugins", { enabled: [] });
    await request("PUT", "/plugins", { enabled: ["greetings"] });
    expect(createGreetingContent).toHaveBeenCalledTimes(2);
  });

  it("keeps settings checked by the plugin's own schema, and keeps them while it is off", async () => {
    expect((await request("GET", "/plugins/greetings/settings")).json()).toEqual({
      greeting: "Hello",
    });

    const invalid = await request("PUT", "/plugins/greetings/settings", { greeting: "" });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().message).toContain("Say something");

    const saved = await request("PUT", "/plugins/greetings/settings", { greeting: "Ahoy" });
    expect(saved.json()).toEqual({ greeting: "Ahoy" });
    await request("PUT", "/plugins", { enabled: ["greetings"] });
    expect((await request("GET", "/greetings")).json()).toEqual({ message: "Ahoy, visitor" });

    await request("PUT", "/plugins", { enabled: [] });
    await request("PUT", "/plugins", { enabled: ["greetings"] });
    expect((await request("GET", "/greetings")).json()).toEqual({ message: "Ahoy, visitor" });
  });

  it("says when a plugin has no settings or doesn't exist", async () => {
    expect((await request("GET", "/plugins/blog/settings")).json()).toMatchObject({
      code: "NOT_FOUND",
      message: "Blog has no settings.",
    });
    expect((await request("GET", "/plugins/time-machine/settings")).statusCode).toBe(404);
  });

  it("offers a plugin's fieldtypes to content types and checks values with them", async () => {
    const fieldtypes = await request("GET", "/fieldtypes");
    expect(fieldtypes.json().fieldtypes.at(-1)).toEqual({
      type: "greetings.mood",
      name: "Mood",
      description: "How the visitor feels.",
      plugin: "greetings",
    });

    const blueprint = await server.inject({
      method: "POST",
      url: "/blueprints",
      cookies: adminCookies,
      payload: {
        handle: "visit",
        name: "Visit",
        fields: [
          { handle: "title", label: "Title", type: "text", required: true },
          { handle: "mood", label: "Mood", type: "greetings.mood" },
        ],
      },
    });
    expect(blueprint.statusCode).toBe(201);
  });
});

describe("checking plugins when the server is built", () => {
  function catalogueWith(plugin: Partial<LintelPlugin>) {
    return () =>
      new PluginCatalogue(pluginRegistry, [
        { id: "parcels", name: "Parcels", description: "Track parcels.", ...plugin },
      ]);
  }

  it("refuses ids that are taken or badly formed", () => {
    expect(catalogueWith({ id: "seo" })).toThrow(InvalidPluginError);
    expect(catalogueWith({ id: "Parcels!" })).toThrow("lowercase letters, numbers and dashes");
  });

  it("refuses permissions, tables and fieldtypes outside the plugin's own name", () => {
    expect(
      catalogueWith({ permissions: [{ permission: "entries:delete", description: "Oops" }] }),
    ).toThrow('its permission "entries:delete" should start with "parcels:"');

    const stray = pgTable("deliveries", { tenantId: text("tenant_id") });
    expect(catalogueWith({ database: { tables: [stray], migrationsFolder: "/nowhere" } })).toThrow(
      'its table "deliveries" should be called "parcels_…"',
    );

    const fieldtype = defineFieldtype({
      type: "weight",
      name: "Weight",
      description: "How heavy.",
      optionsSchema: z.object({}),
      buildValueSchema: () => z.number(),
    });
    expect(catalogueWith({ fieldtypes: [fieldtype] })).toThrow(
      'its fieldtype "weight" should start with "parcels."',
    );
  });

  it("refuses default settings that fail the plugin's own schema", () => {
    expect(
      catalogueWith({ settings: { schema: z.object({ size: z.number() }), defaults: {} } }),
    ).toThrow("default settings");
  });
});
