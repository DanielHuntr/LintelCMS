import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensurePagesCollection } from "../collections/default-collections.js";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest, startTestServer } from "../testing/test-server.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { usersTable } from "../users/users.table.js";
import { isLoopbackAddress, isLoopbackHost } from "../webhooks/address-safety.js";
import { appsTable } from "./apps.table.js";
import { permissionsForScopes, pluginsMissingForScopes } from "./app-scopes.js";

/** An app being built on this computer: it serves its manifest and counts webhooks. */
async function startLocalApp() {
  const local = {
    manifest: {} as object,
    webhooks: 0,
    origin: "",
    server: undefined as Server | undefined,
  };
  local.server = createServer((request, response) => {
    request.resume();
    request.on("end", () => {
      if (request.url === "/lintel-app.json") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify(local.manifest));
        return;
      }
      local.webhooks += 1;
      response.writeHead(200).end("ok");
    });
  });
  await new Promise<void>((resolve) => local.server?.listen(0, "127.0.0.1", resolve));
  const { port } = local.server.address() as AddressInfo;
  local.origin = `http://localhost:${port}`;
  return local;
}

function localManifest(origin: string, changes: object = {}) {
  return {
    name: "Publishing Log",
    handle: "publishing-log",
    description: "Keeps a list of what was published.",
    appUrl: origin,
    scopes: ["read_content"],
    webhooks: [{ event: "entry.published", url: `${origin}/webhooks` }],
    ...changes,
  };
}

describe("apps' development mode", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let api: SendRequest;
  let local: Awaited<ReturnType<typeof startLocalApp>>;

  async function start(available: boolean) {
    // Private addresses stay refused: development mode opens this computer, nothing else.
    server = await startTestServer(testDatabase.activeDatabase, {
      webhooks: { allowPrivateAddresses: false, sendStraightAway: false },
      appDevelopmentModeAvailable: available,
    });
    await ensurePagesCollection(testDatabase.database);
    await createTestUser(testDatabase.database, "admin@example.com", [["*"]]);
    api = requestsAs(server, await signInAndGetCookies(server, "admin@example.com"));
  }

  beforeEach(async () => {
    local = await startLocalApp();
    local.manifest = localManifest(local.origin);
  });

  afterEach(async () => {
    await server.close();
    await new Promise((resolve) => local.server?.close(resolve));
  });

  it("is off to begin with, and an app on this computer is refused with what to do", async () => {
    await start(true);
    expect((await api("GET", "/apps/development-mode")).json()).toEqual({
      available: true,
      on: false,
    });

    const preview = await api("POST", "/apps/preview", {
      manifestUrl: `${local.origin}/lintel-app.json`,
    });

    expect(preview.statusCode).toBe(400);
    expect(preview.json().code).toBe("APP_ON_THIS_COMPUTER");
    expect(preview.json().message).toContain("turn on Development mode");
  });

  it("lets an app on this computer be installed and get its webhooks while it is on", async () => {
    await start(true);
    const turnedOn = await api("PUT", "/apps/development-mode", { on: true });
    expect(turnedOn.json()).toEqual({ available: true, on: true });

    const manifestUrl = `${local.origin}/lintel-app.json`;
    expect((await api("POST", "/apps/preview", { manifestUrl })).statusCode).toBe(200);
    const installed = await api("POST", "/apps", { manifestUrl, approvedScopes: ["read_content"] });
    expect(installed.statusCode, installed.body).toBe(201);

    const created = await api("POST", "/collections/pages/entries", { data: { title: "Hello" } });
    await api("POST", `/entries/${created.json().id}/publish`);
    await server.webhooks.deliverDue();
    expect(local.webhooks).toBe(1);

    // Switched off, the next delivery to this computer is refused again.
    await api("PUT", "/apps/development-mode", { on: false });
    await api("POST", `/entries/${created.json().id}/unpublish`);
    await api("POST", `/entries/${created.json().id}/publish`);
    await server.webhooks.deliverDue();
    expect(local.webhooks).toBe(1);
  });

  it("still refuses the rest of the private network", async () => {
    await start(true);
    await api("PUT", "/apps/development-mode", { on: true });

    const response = await api("POST", "/apps", {
      manifest: localManifest(local.origin, {
        webhooks: [{ event: "entry.published", url: "https://10.0.0.8/webhooks" }],
      }),
      approvedScopes: ["read_content"],
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe("PRIVATE_WEBHOOK_ADDRESS");
  });

  it("doesn't mention it where the server doesn't offer it", async () => {
    await start(false);

    const preview = await api("POST", "/apps/preview", {
      manifestUrl: `${local.origin}/lintel-app.json`,
    });
    const install = await api("POST", "/apps", {
      manifest: local.manifest,
      approvedScopes: ["read_content"],
    });

    expect(preview.statusCode).toBe(400);
    expect(preview.json().code).toBe("APP_MANIFEST_UNREACHABLE");
    expect(preview.body).not.toContain("Development mode");
    expect(install.statusCode).toBe(400);
    expect(install.body).not.toContain("development mode");
  });

  it("can't be turned on where the server doesn't allow it", async () => {
    await start(false);

    const response = await api("PUT", "/apps/development-mode", { on: true });

    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe("APP_DEVELOPMENT_MODE_UNAVAILABLE");
    expect((await api("GET", "/apps/development-mode")).json()).toEqual({
      available: false,
      on: false,
    });
  });

  it("is only changed by people who may change settings", async () => {
    await start(true);
    await createTestUser(testDatabase.database, "editor@example.com", [["entries:*"]]);
    const editor = requestsAs(server, await signInAndGetCookies(server, "editor@example.com"));

    expect((await editor("PUT", "/apps/development-mode", { on: true })).statusCode).toBe(403);
  });
});

describe("forms and orders scopes", () => {
  const testDatabase = useTestDatabase();
  let server: FastifyInstance;
  let api: SendRequest;

  beforeEach(async () => {
    server = await startTestServer(testDatabase.activeDatabase, {
      webhooks: { allowPrivateAddresses: true, sendStraightAway: false },
      appRequestsPerMinute: 1000,
    });
    await createTestUser(testDatabase.database, "owner@example.com", [["*"]]);
    api = requestsAs(server, await signInAndGetCookies(server, "owner@example.com"));
  });

  afterEach(() => server.close());

  const manifest = (scopes: string[]) => ({
    name: "Parcel Labels",
    handle: "parcel-labels",
    description: "Prints labels for new orders.",
    appUrl: "https://labels.example.com",
    scopes,
  });

  function asApp(secret: string, method: "GET" | "POST", url: string, payload?: object) {
    return server.inject({
      method,
      url,
      headers: { authorization: `Bearer ${secret}` },
      ...(payload && { payload }),
    });
  }

  it("won't install an orders app while the shop is off, and says so", async () => {
    await api("PUT", "/plugins", { enabled: [] });

    const preview = await api("POST", "/apps/preview", { manifest: manifest(["read_orders"]) });
    expect(preview.json().missingFeatures).toEqual(["Online shop"]);

    const install = await api("POST", "/apps", {
      manifest: manifest(["read_orders"]),
      approvedScopes: ["read_orders"],
    });
    expect(install.statusCode).toBe(409);
    expect(install.json().message).toBe(
      "This app needs Online shop. Switch it on in Build → Features first.",
    );
  });

  it("lets an orders app see and handle orders, and nothing else in the shop", async () => {
    await api("PUT", "/plugins", { enabled: ["commerce"] });
    const install = await api("POST", "/apps", {
      manifest: manifest(["read_orders", "write_orders"]),
      approvedScopes: ["read_orders", "write_orders"],
    });
    expect(install.statusCode, install.body).toBe(201);
    const { clientSecret } = install.json() as { clientSecret: string };

    expect((await asApp(clientSecret, "GET", "/shop/orders")).statusCode).toBe(200);
    expect((await asApp(clientSecret, "GET", "/shop/products")).statusCode).toBe(403);
    expect((await asApp(clientSecret, "GET", "/shop/settings")).statusCode).toBe(403);
    expect((await asApp(clientSecret, "GET", "/users")).statusCode).toBe(403);

    // Past the permission check for handling an order (there is no such order), not refunds.
    const order = "/shop/orders/00000000-0000-4000-8000-000000000001";
    const note = await asApp(clientSecret, "POST", `${order}/notes`, { message: "Packed" });
    expect(note.statusCode, note.body).toBe(404);
    const refund = await asApp(clientSecret, "POST", `${order}/refunds`, {});
    expect(refund.statusCode, refund.body).toBe(403);
    const cancel = await asApp(clientSecret, "POST", `${order}/cancel`, {});
    expect(cancel.statusCode, cancel.body).toBe(403);
  });

  it("sends for review, rather than publishes, where clients' changes wait for approval", async () => {
    await ensurePagesCollection(testDatabase.database);
    const scopes = ["read_content", "write_content", "publish_content"];
    const install = await api("POST", "/apps", {
      manifest: { ...manifest(scopes), handle: "writer" },
      approvedScopes: scopes,
    });
    const { clientSecret } = install.json() as { clientSecret: string };
    const saved = await api("PATCH", "/client-editing/settings", {
      clientChanges: "needsApproval",
    });
    expect(saved.statusCode, saved.body).toBe(200);
    const created = await asApp(clientSecret, "POST", "/collections/pages/entries", {
      data: { title: "From the app" },
    });
    expect(created.statusCode, created.body).toBe(201);
    const entry = `/entries/${created.json().id as string}`;

    const publish = await asApp(clientSecret, "POST", `${entry}/publish`);
    expect(publish.statusCode).toBe(403);
    expect(publish.json().code).toBe("REVIEW_NEEDED");

    const review = await asApp(clientSecret, "POST", `${entry}/review`, {});
    expect(review.statusCode, review.body).toBe(201);
  });

  it("lets a forms app read forms and their entries, but not change them", async () => {
    await api("PUT", "/plugins", { enabled: ["forms"] });
    const created = await api("POST", "/forms", { name: "Contact", handle: "contact" });
    expect(created.statusCode, created.body).toBe(201);
    const install = await api("POST", "/apps", {
      manifest: {
        ...manifest(["read_forms"]),
        appUrl: "https://crm.example.com",
        webhooks: [{ event: "form.submitted", url: "https://crm.example.com/hook" }],
      },
      approvedScopes: ["read_forms"],
    });
    expect(install.statusCode, install.body).toBe(201);
    const { clientSecret } = install.json() as { clientSecret: string };

    expect((await asApp(clientSecret, "GET", "/forms")).statusCode).toBe(200);
    const formId = created.json().id as string;
    expect((await asApp(clientSecret, "GET", `/forms/${formId}/submissions`)).statusCode).toBe(200);
    expect(
      (await asApp(clientSecret, "POST", "/forms", { name: "Spam", handle: "spam" })).statusCode,
    ).toBe(403);
  });

  it("stops working when the person who installed it is deactivated", async () => {
    const install = await api("POST", "/apps", {
      manifest: { ...manifest(["read_content"]), handle: "reader" },
      approvedScopes: ["read_content"],
    });
    const { clientSecret } = install.json() as { clientSecret: string };
    expect((await asApp(clientSecret, "GET", "/collections")).statusCode).toBe(200);

    const [app] = await testDatabase.database.select().from(appsTable);
    await testDatabase.database
      .update(usersTable)
      .set({ status: "deactivated" })
      .where(eq(usersTable.id, app?.installedBy ?? ""));

    expect((await asApp(clientSecret, "GET", "/collections")).statusCode).toBe(401);
  });
});

describe("scopes and addresses", () => {
  it("never reach settings, people, roles or a page's design", () => {
    const every = permissionsForScopes([
      "read_content",
      "write_content",
      "publish_content",
      "read_media",
      "write_media",
      "read_forms",
      "read_orders",
      "write_orders",
    ]);
    for (const area of ["settings", "users", "roles", "builder", "commerce:refund"]) {
      expect(every.some((permission) => permission.startsWith(area))).toBe(false);
    }
  });

  it("name the features that need switching on", () => {
    expect(
      pluginsMissingForScopes(["read_orders", "write_orders", "read_forms"], ["forms"]),
    ).toEqual(["commerce"]);
    expect(pluginsMissingForScopes(["read_content"], [])).toEqual([]);
  });

  it("count only this computer as local", () => {
    expect(isLoopbackHost(new URL("http://localhost:3000"))).toBe(true);
    expect(isLoopbackHost(new URL("http://app.localhost"))).toBe(true);
    expect(isLoopbackHost(new URL("http://127.0.0.2:3000"))).toBe(true);
    expect(isLoopbackHost(new URL("http://[::1]:3000"))).toBe(true);
    expect(isLoopbackHost(new URL("http://192.168.1.4"))).toBe(false);
    expect(isLoopbackHost(new URL("http://printer.local"))).toBe(false);
    expect(isLoopbackAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isLoopbackAddress("10.0.0.1")).toBe(false);
  });
});
