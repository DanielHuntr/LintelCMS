import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from "fastify";
import sharp from "sharp";
import { afterEach, beforeEach, expect } from "vitest";
import {
  ensureBlogPostsCollection,
  ensurePagesCollection,
} from "../collections/default-collections.js";
import { ensureSiteSettings } from "../globals/default-globals.js";
import { LocalDiskStorage } from "../media/local-disk-storage.js";
import { ensureMainMenu } from "../navigation/default-navigation.js";
import { buildServer } from "../server.js";
import { multipartFile } from "./multipart.js";
import type { useTestDatabase } from "./test-database.js";
import { createTestUser, signInAndGetCookies } from "./test-users.js";
import { buildSiteServer } from "../website/site-server.js";

export const STATIC_TEST_API_URL = "http://api.test";
export const STATIC_TEST_SITE_URL = "https://www.example.com";

/**
 * A Lintel with a small sample site for export and publishing tests: pages, a blog, the
 * Forms and SEO plugins on, real uploads in a temporary folder, and the live website
 * server to compare with.
 */
export function useStaticSiteTestServer(testDatabase: ReturnType<typeof useTestDatabase>) {
  const state = {
    api: undefined as FastifyInstance | undefined,
    site: undefined as FastifyInstance | undefined,
    folder: "",
    cookies: {} as Record<string, string>,
  };

  beforeEach(async () => {
    state.folder = await mkdtemp(join(tmpdir(), "lintel-static-"));
    state.api = buildServer({
      adminOrigin: "http://localhost:5173",
      database: testDatabase.activeDatabase,
      publicApiUrl: STATIC_TEST_API_URL,
      runScheduledJobs: false,
      lintelFolder: {
        dataFolder: join(state.folder, "lintel", "data"),
        configFile: join(state.folder, "lintel", "config.json"),
      },
      website: { builtInSiteUrl: STATIC_TEST_SITE_URL },
      media: {
        storage: new LocalDiskStorage(join(state.folder, "uploads")),
        transformCacheFolder: join(state.folder, "cache"),
      },
    });
    await state.api.ready();
    state.site = buildSiteServer({ api: state.api });
    await state.site.ready();
    await ensurePagesCollection(testDatabase.database);
    await ensureBlogPostsCollection(testDatabase.database);
    await ensureSiteSettings(testDatabase.database);
    await ensureMainMenu(testDatabase.database);
    await createTestUser(testDatabase.database, "owner@example.com", [["*"]]);
    state.cookies = await signInAndGetCookies(state.api, "owner@example.com");
    await send("PUT", "/plugins", { enabled: ["forms", "seo"] });
    await send("PATCH", "/globals/site_settings/values", {
      data: { site_name: "Corner Bakery", footer_text: "Fresh bread every morning." },
    });
  }, 60_000);

  afterEach(async () => {
    await state.site?.close();
    await state.api?.close();
    await rm(state.folder, { recursive: true, force: true });
  });

  function api(): FastifyInstance {
    if (!state.api) throw new Error("The static site test server is only available in tests.");
    return state.api;
  }

  function send(
    method: InjectOptions["method"],
    url: string,
    payload?: InjectOptions["payload"],
  ): Promise<LightMyRequestResponse> {
    return api().inject({
      method,
      url,
      cookies: state.cookies,
      ...(payload === undefined ? {} : { payload }),
    });
  }

  return {
    get api() {
      return api();
    },
    get site() {
      if (!state.site) throw new Error("No site server outside tests.");
      return state.site;
    },
    get folder() {
      return state.folder;
    },
    send,
    async uploadPhoto(): Promise<string> {
      const image = await sharp({
        create: { width: 600, height: 340, channels: 3, background: "#c97b2b" },
      })
        .png()
        .toBuffer();
      const response = await api().inject({
        method: "POST",
        url: "/media",
        cookies: state.cookies,
        ...multipartFile("loaves.png", image, "image/png"),
      });
      expect(response.statusCode, response.body).toBeLessThan(300);
      return (response.json() as { id: string }).id;
    },
    async publish(collection: string, data: Record<string, unknown>, slug?: string) {
      const created = await send("POST", `/collections/${collection}/entries`, {
        data,
        ...(slug ? { slug } : {}),
      });
      expect(created.statusCode, created.body).toBe(201);
      const id = (created.json() as { id: string }).id;
      const published = await send("POST", `/entries/${id}/publish`);
      expect(published.statusCode, published.body).toBe(200);
      return id;
    },
    async republish(entryId: string, data: Record<string, unknown>) {
      const saved = await send("PATCH", `/entries/${entryId}`, { data });
      expect(saved.statusCode, saved.body).toBe(200);
      const published = await send("POST", `/entries/${entryId}/publish`);
      expect(published.statusCode, published.body).toBe(200);
    },
    async createForm(name: string) {
      const response = await send("POST", "/forms", { name, template: "contact" });
      expect(response.statusCode, response.body).toBe(201);
      return response.json() as { id: string; handle: string };
    },
  };
}
