import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import sharp from "sharp";
import { afterEach, beforeEach } from "vitest";
import type { AssetUsage } from "../media/media.errors.js";
import { LocalDiskStorage } from "../media/local-disk-storage.js";
import { buildServer } from "../server.js";
import { multipartFile } from "./multipart.js";
import type { useTestDatabase } from "./test-database.js";
import { createTestUser, signInAndGetCookies } from "./test-users.js";

export const TEST_API_URL = "http://api.test";

/**
 * A server for media tests: uploads and resized images go to a temporary folder that is
 * removed afterwards, and `usage` decides which entries "use" each asset.
 */
export function useMediaTestServer(testDatabase: ReturnType<typeof useTestDatabase>) {
  const state = {
    server: undefined as FastifyInstance | undefined,
    folder: "",
    adminCookies: {} as Record<string, string>,
    usage: new Map<string, AssetUsage[]>(),
  };

  beforeEach(async () => {
    state.folder = await mkdtemp(join(tmpdir(), "lintel-media-"));
    state.usage = new Map();
    state.server = buildServer({
      adminOrigin: "http://localhost:5173",
      database: testDatabase.activeDatabase,
      publicApiUrl: TEST_API_URL,
      media: {
        storage: new LocalDiskStorage(join(state.folder, "uploads")),
        transformCacheFolder: join(state.folder, "cache"),
        usageFinder: { findEntriesUsingAsset: async (assetId) => state.usage.get(assetId) ?? [] },
      },
    });
    await state.server.ready();
    await createTestUser(testDatabase.database, "admin@example.com", [["*"]]);
    state.adminCookies = await signInAndGetCookies(state.server, "admin@example.com");
  });

  afterEach(async () => {
    await state.server?.close();
    await rm(state.folder, { recursive: true, force: true });
  });

  function getServer(): FastifyInstance {
    if (!state.server) {
      throw new Error("The media test server is only available inside tests and hooks.");
    }
    return state.server;
  }

  return {
    get server() {
      return getServer();
    },
    get adminCookies() {
      return state.adminCookies;
    },
    get uploadsFolder() {
      return join(state.folder, "uploads");
    },
    get cacheFolder() {
      return join(state.folder, "cache");
    },
    /** Pretend these entries use the asset, as the entries feature would report. */
    markAssetUsed(assetId: string, usedBy: AssetUsage[]) {
      state.usage.set(assetId, usedBy);
    },
    upload(
      filename: string,
      contents: Buffer,
      cookies = state.adminCookies,
    ): Promise<LightMyRequestResponse> {
      return getServer().inject({
        method: "POST",
        url: "/media",
        cookies,
        ...multipartFile(filename, contents),
      });
    },
  };
}

/**
 * A real PNG: the left half red and the right half blue, so a crop shows which side it kept.
 * A seed changes one pixel, making images that look alike but are different files.
 */
export function makeTestPng(width = 400, height = 200, seed = 0): Promise<Buffer> {
  const halfWidth = Math.floor(width / 2);
  return sharp({ create: { width, height, channels: 3, background: "#ff0000" } })
    .composite([
      {
        input: { create: { width: width - halfWidth, height, channels: 3, background: "#0000ff" } },
        left: halfWidth,
        top: 0,
      },
      {
        input: {
          create: { width: 1, height: 1, channels: 3, background: { r: seed % 256, g: 0, b: 0 } },
        },
        left: 0,
        top: 0,
      },
    ])
    .png()
    .toBuffer();
}
