import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach } from "vitest";
import {
  ensureBlogPostsCollection,
  ensurePagesCollection,
} from "../collections/default-collections.js";
import { LocalDiskStorage } from "../media/local-disk-storage.js";
import type { useTestDatabase } from "./test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "./test-server.js";
import { createTestUser, signInAndGetCookies } from "./test-users.js";

/**
 * A server for backup, export and import tests: uploads, backups and imports go to a
 * temporary folder that is removed afterwards. Pages and Blog posts exist, and `api` sends
 * requests as a Super admin.
 */
export function useDataToolsTestServer(testDatabase: ReturnType<typeof useTestDatabase>) {
  const state = {
    server: undefined as FastifyInstance | undefined,
    folder: "",
    api: undefined as SendRequest | undefined,
    cookies: {} as Record<string, string>,
  };

  beforeEach(async () => {
    state.folder = await mkdtemp(join(tmpdir(), "lintel-data-tools-"));
    state.server = await startTestServer(testDatabase.activeDatabase, {
      publicApiUrl: "http://api.test",
      media: {
        storage: new LocalDiskStorage(join(state.folder, "uploads")),
        transformCacheFolder: join(state.folder, "cache"),
      },
      dataTools: {
        backupsFolder: join(state.folder, "backups"),
        importsFolder: join(state.folder, "imports"),
        allowPrivateDownloads: true,
      },
    });
    await ensurePagesCollection(testDatabase.database);
    await ensureBlogPostsCollection(testDatabase.database);
    await createTestUser(testDatabase.database, "admin@example.com", [["*"]]);
    state.cookies = await signInAndGetCookies(state.server, "admin@example.com");
    state.api = requestsAs(state.server, state.cookies);
  });

  afterEach(async () => {
    await state.server?.close();
    await rm(state.folder, { recursive: true, force: true });
  });

  function required<Value>(value: Value | undefined): Value {
    if (value === undefined) {
      throw new Error("The data tools test server is only available inside tests and hooks.");
    }
    return value;
  }

  return {
    get server() {
      return required(state.server);
    },
    get api() {
      return required(state.api);
    },
    get cookies() {
      return state.cookies;
    },
    get folder() {
      return state.folder;
    },
    /** Signs in again, for after a restore has signed everyone out. */
    async signInAgain() {
      state.cookies = await signInAndGetCookies(required(state.server), "admin@example.com");
      state.api = requestsAs(required(state.server), state.cookies);
      return state.api;
    },
  };
}
