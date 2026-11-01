import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from "fastify";
import { afterEach, beforeEach } from "vitest";
import { DEFAULT_EMAIL_FROM } from "../email/email.config.js";
import { createEmailSender, OutboxEmailDriver } from "../email/index.js";
import { LocalDiskStorage } from "../media/local-disk-storage.js";
import { buildServer } from "../server.js";
import { readSetting } from "../settings/settings.service.js";
import type { useTestDatabase } from "./test-database.js";
import { createTestUser, signInAndGetCookies } from "./test-users.js";
import { issueFormToken } from "../forms/spam-protection.js";

export const TEST_API_URL = "http://api.test";
export const TEST_ADMIN_ORIGIN = "http://localhost:5173";

/**
 * A server for forms tests: the Forms plugin on, uploads in a temporary folder, emails
 * kept in an outbox, webhooks sent only by hand and a Turnstile check the test controls.
 */
export function useFormsTestServer(testDatabase: ReturnType<typeof useTestDatabase>) {
  const state = {
    server: undefined as FastifyInstance | undefined,
    folder: "",
    cookies: {} as Record<string, string>,
    outbox: new OutboxEmailDriver(),
    turnstilePasses: true,
    turnstileChecks: [] as string[],
  };

  beforeEach(async () => {
    state.folder = await mkdtemp(join(tmpdir(), "lintel-forms-"));
    state.outbox = new OutboxEmailDriver();
    state.turnstilePasses = true;
    state.turnstileChecks = [];
    state.server = buildServer({
      adminOrigin: TEST_ADMIN_ORIGIN,
      database: testDatabase.activeDatabase,
      publicApiUrl: TEST_API_URL,
      runScheduledJobs: false,
      email: createEmailSender(state.outbox, { defaultFrom: DEFAULT_EMAIL_FROM }),
      webhooks: { allowPrivateAddresses: true, sendStraightAway: false },
      media: {
        storage: new LocalDiskStorage(join(state.folder, "uploads")),
        transformCacheFolder: join(state.folder, "cache"),
      },
      formsTurnstileVerifier: async ({ response }) => {
        state.turnstileChecks.push(response);
        return state.turnstilePasses;
      },
    });
    await state.server.ready();
    await createTestUser(testDatabase.database, "owner@example.com", [["*"]]);
    state.cookies = await signInAndGetCookies(state.server, "owner@example.com");
    await state.server.inject({
      method: "PUT",
      url: "/plugins",
      cookies: state.cookies,
      payload: { enabled: ["forms"] },
    });
  });

  afterEach(async () => {
    await state.server?.close();
    await rm(state.folder, { recursive: true, force: true });
  });

  function server(): FastifyInstance {
    if (!state.server) throw new Error("The forms test server is only available inside tests.");
    return state.server;
  }

  return {
    get server() {
      return server();
    },
    get cookies() {
      return state.cookies;
    },
    get outbox() {
      return state.outbox;
    },
    get turnstileChecks() {
      return state.turnstileChecks;
    },
    set turnstilePasses(passes: boolean) {
      state.turnstilePasses = passes;
    },
    /** Sends a request as the signed-in owner. */
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
    async createForm(name: string, template = "blank") {
      const response = await server().inject({
        method: "POST",
        url: "/forms",
        cookies: state.cookies,
        payload: { name, template },
      });
      return response.json() as { id: string; handle: string };
    },
    /** A token for a form opened `secondsAgo` seconds ago, as a visitor's page would hold. */
    async tokenFor(form: { id: string; handle: string }, secondsAgo = 30) {
      // Reading the public form makes the signing secret the first time.
      await server().inject({ method: "GET", url: `/delivery/forms/${form.handle}` });
      const secret = (await readSetting(testDatabase.database, "formsSigningSecret")) ?? "";
      return issueFormToken(secret, form.id, new Date(Date.now() - secondsAgo * 1000));
    },
    /** Sends answers the way a visitor's browser would, with a token from a while ago. */
    async submit(
      form: { id: string; handle: string },
      answers: Record<string, unknown>,
    ): Promise<LightMyRequestResponse> {
      return server().inject({
        method: "POST",
        url: `/delivery/forms/${form.handle}/submissions`,
        payload: { _token: await this.tokenFor(form), ...answers },
      });
    },
  };
}
