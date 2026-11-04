import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensurePagesCollection } from "../collections/default-collections.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { CLIENT_ROLE_HANDLE } from "../roles/built-in-roles.js";
import { assignRoleToUser, findRoleByHandle } from "../roles/roles.repository.js";
import { ensureBuiltInRoles } from "../roles/roles.service.js";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { usersTable } from "../users/users.table.js";
import { queueWebhookEvent } from "../webhooks/webhook-deliveries.service.js";
import { verifyWebhookSignature } from "../webhooks/webhook-signatures.js";
import { webhookDeliveriesTable, webhooksTable } from "../webhooks/webhooks.table.js";
import type { AppManifestInput } from "./app-manifest.schema.js";
import { AppRequestLimiter } from "./app-rate-limit.js";
import { verifySessionToken } from "./app-session-tokens.js";
import { appsTable } from "./apps.table.js";

/** The app's own server on this machine: it serves its manifest and receives webhooks. */
async function startAppServer() {
  const appServer = {
    manifest: {} as AppManifestInput,
    received: [] as Array<{ headers: IncomingHttpHeaders; body: string }>,
    origin: "",
    server: undefined as Server | undefined,
  };
  appServer.server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk: Buffer) => (body += chunk.toString()));
    request.on("end", () => {
      if (request.url === "/lintel-app.json") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify(appServer.manifest));
        return;
      }
      appServer.received.push({ headers: request.headers, body });
      response.writeHead(200).end("ok");
    });
  });
  await new Promise<void>((resolve) => appServer.server?.listen(0, "127.0.0.1", resolve));
  const { port } = appServer.server.address() as AddressInfo;
  appServer.origin = `http://127.0.0.1:${port}`;
  return appServer;
}

function stockSyncManifest(origin: string, changes: Partial<AppManifestInput> = {}) {
  return {
    name: "Stock Sync",
    handle: "stock-sync",
    description: "Keeps product pages in step with the warehouse.",
    appUrl: origin,
    scopes: ["read_content"],
    webhooks: [{ event: "entry.published", url: `${origin}/webhooks` }],
    admin: {
      page: { label: "Stock", url: `${origin}/admin` },
      dashboardWidgets: [
        {
          id: "low-stock",
          title: "Low stock",
          description: "Running out soon",
          url: `${origin}/widget`,
        },
      ],
      editorPanels: [
        { id: "stock", title: "Stock", url: `${origin}/panel`, collections: ["pages"] },
      ],
      settingsPage: { url: `${origin}/settings` },
    },
    ...changes,
  } satisfies AppManifestInput;
}

describe("apps", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let adminCookies: Record<string, string>;
  let api: SendRequest;
  let appServer: Awaited<ReturnType<typeof startAppServer>>;

  beforeEach(async () => {
    appServer = await startAppServer();
    server = await startTestServer(testDatabase.activeDatabase, {
      webhooks: { allowPrivateAddresses: true, sendStraightAway: false },
      appRequestsPerMinute: 1000,
    });
    await ensurePagesCollection(testDatabase.database);
    await createTestUser(testDatabase.database, "admin@example.com", [["*"]]);
    adminCookies = await signInAndGetCookies(server, "admin@example.com");
    api = requestsAs(server, adminCookies);
  });

  afterEach(async () => {
    await server.close();
    await new Promise((resolve) => appServer.server?.close(resolve));
  });

  async function install(manifest: object = stockSyncManifest(appServer.origin)) {
    const scopes = (manifest as { scopes?: string[] }).scopes ?? [];
    const response = await api("POST", "/apps", { manifest, approvedScopes: scopes });
    expect(response.statusCode, response.body).toBe(201);
    return response.json() as { app: { id: string; clientId: string }; clientSecret: string };
  }

  function asApp(secret: string, method: "GET" | "POST", url: string, payload?: object) {
    return server.inject({
      method,
      url,
      headers: { authorization: `Bearer ${secret}` },
      ...(payload && { payload }),
    });
  }

  describe("adding an app", () => {
    it("previews a pasted manifest without installing anything", async () => {
      const preview = await api("POST", "/apps/preview", {
        manifest: stockSyncManifest(appServer.origin),
      });

      expect(preview.statusCode).toBe(200);
      expect(preview.json()).toMatchObject({
        manifest: { name: "Stock Sync", scopes: ["read_content"] },
        manifestUrl: null,
        alreadyInstalled: false,
      });
      expect(await testDatabase.database.select().from(appsTable)).toHaveLength(0);
    });

    it("reads the manifest from its web address", async () => {
      appServer.manifest = stockSyncManifest(appServer.origin);
      const manifestUrl = `${appServer.origin}/lintel-app.json`;

      const preview = await api("POST", "/apps/preview", { manifestUrl });

      expect(preview.json()).toMatchObject({ manifest: { handle: "stock-sync" }, manifestUrl });
    });

    it("explains what is wrong with a manifest", async () => {
      const preview = await api("POST", "/apps/preview", {
        manifest: stockSyncManifest(appServer.origin, {
          scopes: [],
          admin: { page: { label: "Stock", url: "https://elsewhere.example.com/admin" } },
        }),
      });

      expect(preview.statusCode).toBe(400);
      expect(preview.json().code).toBe("INVALID_APP_MANIFEST");
      expect(preview.json().message).toContain("must be on " + appServer.origin);
      expect(preview.json().message).toContain(
        "entry.published webhook needs the read_content scope",
      );
    });

    it("won't read manifests from private addresses unless the server allows it", async () => {
      const strict = await startTestServer(testDatabase.activeDatabase);
      const response = await strict.inject({
        method: "POST",
        url: "/apps/preview",
        cookies: adminCookies,
        payload: { manifestUrl: `${appServer.origin}/lintel-app.json` },
      });
      await strict.close();

      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe("APP_MANIFEST_UNREACHABLE");
    });

    it("refuses apps hosted on Lintel's own address, where frames can't be sandboxed", async () => {
      const response = await api("POST", "/apps/preview", {
        manifest: stockSyncManifest("http://localhost:5173", { webhooks: [] }),
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe("APP_ORIGIN_NOT_ALLOWED");
    });

    it("only installs what was approved, once", async () => {
      const manifest = stockSyncManifest(appServer.origin);
      const changed = await api("POST", "/apps", { manifest, approvedScopes: [] });
      expect(changed.statusCode).toBe(409);
      expect(changed.json().code).toBe("APP_SCOPES_CHANGED");

      await install(manifest);
      const again = await api("POST", "/apps", { manifest, approvedScopes: ["read_content"] });
      expect(again.statusCode).toBe(409);
      expect(again.json().code).toBe("APP_ALREADY_INSTALLED");
      expect((await api("POST", "/apps/preview", { manifest })).json().alreadyInstalled).toBe(true);
    });

    it("needs the settings permission", async () => {
      await createTestUser(testDatabase.database, "editor@example.com", [["entries:*"]]);
      const editor = requestsAs(server, await signInAndGetCookies(server, "editor@example.com"));
      const manifest = stockSyncManifest(appServer.origin);

      expect(
        (await editor("POST", "/apps", { manifest, approvedScopes: ["read_content"] })).statusCode,
      ).toBe(403);
      expect((await editor("GET", "/apps")).statusCode).toBe(403);
    });
  });

  describe("installing", () => {
    it("shows the client secret once and keeps only what it needs", async () => {
      const response = await api("POST", "/apps", {
        manifest: stockSyncManifest(appServer.origin),
        approvedScopes: ["read_content"],
      });

      expect(response.headers["cache-control"]).toBe("no-store");
      const { app, clientSecret } = response.json();
      expect(clientSecret).toMatch(/^lintelapp_[\w-]{43}$/);
      expect(app).toMatchObject({
        name: "Stock Sync",
        clientId: expect.stringMatching(/^app_[0-9a-f]{20}$/),
        clientSecretStart: clientSecret.slice(0, 14),
        installedBy: { name: "Ana Editor" },
      });
      const list = await api("GET", "/apps");
      expect(list.json().apps).toHaveLength(1);
      expect(list.body).not.toContain(clientSecret);
      expect((await api("GET", `/apps/${app.id}`)).body).not.toContain(clientSecret);
    });

    it("subscribes the app's webhooks, signed with its client secret and kept out of Settings → Webhooks", async () => {
      const { app, clientSecret } = await install();

      const webhooks = await testDatabase.database.select().from(webhooksTable);
      expect(webhooks).toMatchObject([
        { appId: app.id, url: `${appServer.origin}/webhooks`, events: ["entry.published"] },
      ]);
      expect((await api("GET", "/webhooks")).json().webhooks).toEqual([]);
      expect((await api("GET", `/webhooks/${webhooks[0]?.id}`)).statusCode).toBe(404);

      const created = await api("POST", "/collections/pages/entries", { data: { title: "Boots" } });
      await api("POST", `/entries/${created.json().id}/publish`);
      await server.webhooks.deliverDue();

      const [delivered] = appServer.received;
      expect(delivered?.headers["lintel-event"]).toBe("entry.published");
      expect(
        verifyWebhookSignature(
          clientSecret,
          delivered?.body ?? "",
          String(delivered?.headers["lintel-signature"]),
        ),
      ).toBe(true);
    });
  });

  describe("calling the API", () => {
    it("can do what its scopes allow and nothing more", async () => {
      const { clientSecret } = await install();

      expect((await asApp(clientSecret, "GET", "/collections")).statusCode).toBe(200);
      expect((await asApp(clientSecret, "GET", "/collections/pages/entries")).statusCode).toBe(200);
      const write = await asApp(clientSecret, "POST", "/collections/pages/entries", {
        data: { title: "Sneaky" },
      });
      expect(write.statusCode).toBe(403);
      expect((await asApp(clientSecret, "GET", "/media")).statusCode).toBe(403);
      expect((await asApp(clientSecret, "GET", "/plugins")).statusCode).toBe(403);
      expect((await asApp(clientSecret, "GET", "/apps")).statusCode).toBe(403);
      expect((await asApp(clientSecret, "GET", "/webhooks")).statusCode).toBe(403);
    });

    it("never has more access than the person who installed it", async () => {
      await createTestUser(testDatabase.database, "manager@example.com", [
        ["settings:*", "entries:read", "collections:read"],
      ]);
      const manager = requestsAs(server, await signInAndGetCookies(server, "manager@example.com"));
      const manifest = stockSyncManifest(appServer.origin, {
        scopes: ["read_content", "write_content"],
      });
      const installed = await manager("POST", "/apps", {
        manifest,
        approvedScopes: ["read_content", "write_content"],
      });
      const { clientSecret } = installed.json();

      expect((await asApp(clientSecret, "GET", "/collections/pages/entries")).statusCode).toBe(200);
      const write = await asApp(clientSecret, "POST", "/collections/pages/entries", {
        data: { title: "Not allowed for the manager" },
      });
      expect(write.statusCode).toBe(403);
    });

    it("acts for its installer, and records when it was last used", async () => {
      const { app, clientSecret } = await install(
        stockSyncManifest(appServer.origin, { scopes: ["read_content", "write_content"] }),
      );

      const created = await asApp(clientSecret, "POST", "/collections/pages/entries", {
        data: { title: "Made by the app" },
      });

      expect(created.statusCode).toBe(201);
      expect((await api("GET", `/apps/${app.id}`)).json().lastUsedAt).not.toBeNull();
    });

    it("is refused with a wrong secret", async () => {
      const wrong = await asApp(`lintelapp_${"x".repeat(43)}`, "GET", "/collections");
      expect(wrong.statusCode).toBe(401);
      expect(wrong.json().code).toBe("INVALID_API_TOKEN");
    });

    it("is limited to a number of requests a minute", async () => {
      const limited = await startTestServer(testDatabase.activeDatabase, {
        webhooks: { allowPrivateAddresses: true },
        appRequestsPerMinute: 2,
      });
      const { clientSecret } = await install();
      const call = () =>
        limited.inject({
          method: "GET",
          url: "/collections",
          headers: { authorization: `Bearer ${clientSecret}` },
        });

      expect((await call()).statusCode).toBe(200);
      expect((await call()).statusCode).toBe(200);
      const third = await call();
      await limited.close();

      expect(third.statusCode).toBe(429);
      expect(third.json().code).toBe("APP_RATE_LIMITED");
      expect(Number(third.headers["retry-after"])).toBeGreaterThan(0);
    });
  });

  describe("session tokens", () => {
    it("tells the app's page who is looking and what the app may do for them", async () => {
      const { app, clientSecret } = await install();

      const response = await api("POST", `/apps/${app.id}/session-token`);

      expect(response.statusCode).toBe(200);
      expect(response.headers["cache-control"]).toBe("no-store");
      const { token, expiresAt } = response.json();
      const check = verifySessionToken(clientSecret, token, { clientId: app.clientId });
      expect(check).toMatchObject({
        valid: true,
        claims: {
          aud: app.clientId,
          appId: app.id,
          dest: "http://localhost:5173",
          iss: "http://localhost:4000",
          permissions: expect.arrayContaining(["entries:read", "collections:read"]),
        },
      });
      expect(new Date(expiresAt).getTime() - Date.now()).toBeLessThanOrEqual(5 * 60 * 1000);
    });

    it("cuts the token's permissions down to the viewer's", async () => {
      const { app, clientSecret } = await install();
      await createTestUser(testDatabase.database, "viewer@example.com", [["collections:read"]]);
      const viewer = requestsAs(server, await signInAndGetCookies(server, "viewer@example.com"));

      const { token } = (await viewer("POST", `/apps/${app.id}/session-token`)).json();
      const check = verifySessionToken(clientSecret, token, { clientId: app.clientId });

      expect(check.valid && check.claims.permissions).toEqual(["collections:read"]);
    });

    it("isn't given to an app calling with its own secret", async () => {
      const { app, clientSecret } = await install();
      const response = await asApp(clientSecret, "POST", `/apps/${app.id}/session-token`);
      expect(response.statusCode).toBe(403);
      expect(response.json().code).toBe("SESSION_TOKEN_NEEDS_ADMIN");
    });
  });

  describe("the admin's extension points", () => {
    it("lists every app's pages, widgets and panels for people signed in", async () => {
      await install();
      await createTestUser(testDatabase.database, "writer@example.com", [["entries:read"]]);
      const writer = requestsAs(server, await signInAndGetCookies(server, "writer@example.com"));

      const response = await writer("GET", "/apps/extensions");

      expect(response.statusCode).toBe(200);
      expect(response.json().apps).toMatchObject([
        {
          handle: "stock-sync",
          origin: appServer.origin,
          admin: {
            page: { label: "Stock" },
            dashboardWidgets: [{ id: "low-stock", size: "medium" }],
            editorPanels: [{ id: "stock", collections: ["pages"] }],
          },
        },
      ]);
      expect(response.body).not.toContain("lintelapp_");
    });

    describe("who a page is for (LINTEL-UX-334)", () => {
      async function extensionsFor(email: string, roleHandle: string) {
        const person = await createTestUser(testDatabase.database, email, []);
        await ensureBuiltInRoles(testDatabase.database);
        const role = await findRoleByHandle(testDatabase.database, DEFAULT_TENANT_ID, roleHandle);
        await assignRoleToUser(testDatabase.database, person.id, role?.id ?? "");
        const signedIn = requestsAs(server, await signInAndGetCookies(server, email));
        return (await signedIn("GET", "/apps/extensions")).json().apps[0].admin;
      }

      it("leaves a page that names no roles out for clients, keeping the rest", async () => {
        await install();

        const admin = await extensionsFor("client@example.com", CLIENT_ROLE_HANDLE);

        expect(admin.page).toBeUndefined();
        expect(admin.dashboardWidgets).toHaveLength(1);
        expect((await extensionsFor("editor@example.com", "editor")).page).toBeDefined();
        expect((await extensionsFor("viewer@example.com", "viewer")).page).toBeUndefined();
        expect((await extensionsFor("owner@example.com", "owner")).page).toBeDefined();
      });

      it("shows a page to the roles it names and Owners, and nobody else", async () => {
        const manifest = stockSyncManifest(appServer.origin);
        await install({
          ...manifest,
          admin: {
            ...manifest.admin,
            page: { ...manifest.admin.page, roles: [CLIENT_ROLE_HANDLE] },
          },
        });

        expect((await extensionsFor("client@example.com", CLIENT_ROLE_HANDLE)).page).toBeDefined();
        expect((await extensionsFor("owner@example.com", "owner")).page).toBeDefined();
        expect((await extensionsFor("editor@example.com", "editor")).page).toBeUndefined();
        const custom = requestsAs(server, adminCookies);
        expect((await custom("GET", "/apps/extensions")).json().apps[0].admin.page).toBeUndefined();
      });

      it("refuses a role that doesn't exist", async () => {
        const manifest = stockSyncManifest(appServer.origin);
        const response = await api("POST", "/apps/preview", {
          manifest: {
            ...manifest,
            admin: { ...manifest.admin, page: { ...manifest.admin.page, roles: ["everyone"] } },
          },
        });

        expect(response.statusCode).toBe(400);
        expect(response.body).toContain("Roles are one of");
      });
    });
  });

  describe("uninstalling", () => {
    it("revokes the credential and removes the webhooks, their log and the admin parts", async () => {
      const { app, clientSecret } = await install();
      const created = await api("POST", "/collections/pages/entries", { data: { title: "Hats" } });
      await api("POST", `/entries/${created.json().id}/publish`);
      expect(await testDatabase.database.select().from(webhookDeliveriesTable)).toHaveLength(1);

      expect((await api("DELETE", `/apps/${app.id}`)).statusCode).toBe(204);

      expect((await asApp(clientSecret, "GET", "/collections")).statusCode).toBe(401);
      expect(await testDatabase.database.select().from(webhooksTable)).toEqual([]);
      expect(await testDatabase.database.select().from(webhookDeliveriesTable)).toEqual([]);
      expect((await api("GET", "/apps/extensions")).json().apps).toEqual([]);
      expect((await api("POST", `/apps/${app.id}/session-token`)).statusCode).toBe(404);
      expect((await api("DELETE", `/apps/${app.id}`)).statusCode).toBe(404);
    });

    it("stops telling the app about events while its installer is deactivated", async () => {
      await install();
      expect(await queueWebhookEvent(testDatabase.database, "entry.published", {})).toBe(1);

      await testDatabase.database
        .update(usersTable)
        .set({ status: "deactivated" })
        .where(eq(usersTable.email, "admin@example.com"));

      expect(await queueWebhookEvent(testDatabase.database, "entry.published", {})).toBe(0);
    });

    it("happens when the installer's account is deleted", async () => {
      const { clientSecret } = await install();
      await testDatabase.database
        .delete(usersTable)
        .where(eq(usersTable.email, "admin@example.com"));

      expect(await testDatabase.database.select().from(appsTable)).toEqual([]);
      expect(await testDatabase.database.select().from(webhooksTable)).toEqual([]);
      expect((await asApp(clientSecret, "GET", "/collections")).statusCode).toBe(401);
    });
  });
});

describe("AppRequestLimiter", () => {
  it("allows a number of requests per app each minute, then says how long to wait", () => {
    const limiter = new AppRequestLimiter(2);
    const start = 1_000_000;

    expect(limiter.take("app-a", start)).toBeUndefined();
    expect(limiter.take("app-a", start + 1)).toBeUndefined();
    expect(limiter.take("app-a", start + 15_000)).toBe(45);
    expect(limiter.take("app-b", start + 15_000)).toBeUndefined();
    expect(limiter.take("app-a", start + 60_000)).toBeUndefined();
  });
});
