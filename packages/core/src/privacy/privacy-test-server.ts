import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from "fastify";
import { afterEach, beforeEach } from "vitest";
import { marketsTable } from "../commerce/markets/markets.table.js";
import { LocalDiskStorage } from "../media/local-disk-storage.js";
import type { LintelPlugin } from "../plugins/plugin-definition.js";
import { buildServer } from "../server.js";
import type { useTestDatabase } from "../testing/test-database.js";
import { issueFormToken } from "../forms/spam-protection.js";
import { readSetting } from "../settings/settings.service.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";

/**
 * A server for the privacy tests: Forms and the shop on, plugins the test hands in, and an
 * owner signed in. Forms are made and filled in with the same helpers as the forms tests.
 */
export function usePrivacyTestServer(
  testDatabase: ReturnType<typeof useTestDatabase>,
  plugins: readonly LintelPlugin[] = [],
) {
  const state = {
    server: undefined as FastifyInstance | undefined,
    folder: "",
    cookies: {} as Record<string, string>,
  };

  beforeEach(async () => {
    state.folder = await mkdtemp(join(tmpdir(), "lintel-privacy-"));
    state.server = buildServer({
      adminOrigin: "http://localhost:5173",
      database: testDatabase.activeDatabase,
      publicApiUrl: "http://api.test",
      runScheduledJobs: false,
      plugins,
      media: {
        storage: new LocalDiskStorage(join(state.folder, "uploads")),
        transformCacheFolder: join(state.folder, "cache"),
      },
      formsTurnstileVerifier: async () => true,
      commerce: {
        environment: { STRIPE_SECRET_KEY: "sk_test_a", STRIPE_WEBHOOK_SECRET: "whsec_a" },
      },
    });
    await state.server.ready();
    await createTestUser(testDatabase.database, "owner@example.com", [["*"]]);
    state.cookies = await signInAndGetCookies(state.server, "owner@example.com");
    await state.server.inject({
      method: "PUT",
      url: "/plugins",
      cookies: state.cookies,
      payload: { enabled: ["forms", "commerce", ...plugins.map((plugin) => plugin.id)] },
    });
  });

  afterEach(async () => {
    await state.server?.close();
    await rm(state.folder, { recursive: true, force: true });
  });

  function server(): FastifyInstance {
    if (!state.server) throw new Error("The privacy test server is only available inside tests.");
    return state.server;
  }

  return {
    get server() {
      return server();
    },
    api(
      method: InjectOptions["method"],
      url: string,
      payload?: InjectOptions["payload"],
    ): Promise<LightMyRequestResponse> {
      return server().inject({
        method,
        url,
        cookies: state.cookies,
        ...(payload === undefined ? {} : { payload }),
      });
    },
    async createForm(name: string, template = "contact") {
      const response = await server().inject({
        method: "POST",
        url: "/forms",
        cookies: state.cookies,
        payload: { name, template },
      });
      return response.json() as { id: string; handle: string };
    },
    /** Sends answers the way a visitor's browser would, from a page on the site. */
    async submit(form: { id: string; handle: string }, answers: Record<string, unknown>) {
      await server().inject({ method: "GET", url: `/delivery/forms/${form.handle}` });
      const secret = (await readSetting(testDatabase.database, "formsSigningSecret")) ?? "";
      const token = issueFormToken(secret, form.id, new Date(Date.now() - 30_000));
      return server().inject({
        method: "POST",
        url: `/delivery/forms/${form.handle}/submissions`,
        headers: { referer: "https://bakery.test/contact" },
        payload: { _token: token, ...answers },
      });
    },
    async createMarket() {
      const [market] = await testDatabase.database
        .insert(marketsTable)
        .values({ name: "United Kingdom", handle: "uk", currency: "GBP", isPrimary: true })
        .returning();
      if (!market) throw new Error("No market was made.");
      return market;
    },
  };
}
