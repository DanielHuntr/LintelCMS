import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { gunzipSync } from "node:zlib";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { ensurePagesCollection } from "../collections/default-collections.js";
import { forgetAnalyticsTags } from "../analytics/page-tag.js";
import { LocalDiskStorage } from "../media/local-disk-storage.js";
import { setEnabledPlugins } from "../plugins/plugins.service.js";
import { useTestDatabase } from "../testing/test-database.js";
import { createPersonWithRole } from "../testing/test-people.js";
import { SESSION_COOKIE_NAME } from "../auth/session-cookie.js";
import { createTestUser, TEST_PASSWORD } from "../testing/test-users.js";
import { builtInPublicSite } from "../website/built-in-public-site.js";
import { productionLoggerOptions } from "./logging.js";
import { buildProductionServer, type ProductionServerOptions } from "./production-server.js";

const BUILT_INDEX = `<!doctype html><html lang="en"><head><meta charset="UTF-8" /><title>Lintel</title><script type="module" src="./assets/index-a1b2c3d4.js"></script></head><body><div id="root"></div></body></html>`;

describe("the production server", () => {
  const testDatabase = useTestDatabase();
  let folder: string;
  let server: FastifyInstance | undefined;

  async function start(options: Partial<ProductionServerOptions> = {}) {
    server = buildProductionServer({
      adminOrigin: "https://example.com",
      database: testDatabase.activeDatabase,
      publicApiUrl: "https://example.com/api",
      runScheduledJobs: false,
      media: {
        storage: new LocalDiskStorage(join(folder, "uploads")),
        transformCacheFolder: join(folder, "cache"),
      },
      adminPath: "/admin",
      adminBuildFolder: join(folder, "admin"),
      adminApiUrl: "/api",
      trustProxy: ["loopback"],
      ...options,
    });
    return server;
  }

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "lintel-production-"));
    await mkdir(join(folder, "admin", "assets"), { recursive: true });
    await writeFile(join(folder, "admin", "index.html"), BUILT_INDEX);
    await writeFile(join(folder, "admin", "assets", "index-a1b2c3d4.js"), "console.log('admin');");
    await writeFile(join(folder, "admin", "favicon.svg"), "<svg/>");
  });
  afterEach(async () => {
    await server?.close();
    server = undefined;
    await rm(folder, { recursive: true, force: true });
  });

  it("serves the built-in website at every other address, and keeps the API's own 404s", async () => {
    const app = await start({
      publicSite: builtInPublicSite,
      website: { builtInSiteUrl: "https://example.com" },
    });

    const home = await app.inject({ method: "GET", url: "/" });
    expect(home.statusCode).toBe(200);
    expect(home.headers["content-type"]).toContain("text/html");
    expect(home.body).toContain("This website has no home page yet");
    const admin = await app.inject({ method: "GET", url: "/admin/" });
    expect(admin.body).toContain('<div id="root">');
    const missingApi = await app.inject({ method: "GET", url: "/api/no-such-route" });
    expect(missingApi.statusCode).toBe(404);
    expect(missingApi.headers["content-type"]).toContain("application/json");
  });

  it("serves the live connection under the API's address", async () => {
    const app = await start({ publicSite: builtInPublicSite });
    await app.listen({ port: 0, host: "127.0.0.1" });
    const { port } = app.server.address() as AddressInfo;
    const refused = await new Promise<number>((resolve, reject) => {
      const socket = new WebSocket(`ws://127.0.0.1:${port}/api/live`, {
        headers: { origin: "https://example.com" },
      });
      socket.on("unexpected-response", (_request, response) => resolve(response.statusCode ?? 0));
      socket.on("open", () => reject(new Error("It opened without a session")));
      socket.on("error", () => undefined);
    });
    // Asking who you are, rather than falling through to the website.
    expect(refused).toBe(401);
  });

  it("opens the live connection for someone signed in, past compression and the website", async () => {
    const app = await start({ publicSite: builtInPublicSite });
    await createPersonWithRole(testDatabase.database, "sam@example.com", "owner", "Sam Lee");
    const signedIn = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in",
      payload: { email: "sam@example.com", password: TEST_PASSWORD },
    });
    const cookie = signedIn.cookies.find((each) => each.name === SESSION_COOKIE_NAME);
    await app.listen({ port: 0, host: "127.0.0.1" });
    const { port } = app.server.address() as AddressInfo;
    const welcome = await new Promise<string>((resolve, reject) => {
      const socket = new WebSocket(`ws://127.0.0.1:${port}/api/live`, {
        headers: {
          origin: "https://example.com",
          cookie: `${SESSION_COOKIE_NAME}=${cookie?.value ?? ""}`,
        },
      });
      socket.on("message", (data: Buffer) => {
        resolve(data.toString());
        socket.close();
      });
      socket.on("error", reject);
      socket.on("unexpected-response", (_request, response) =>
        reject(new Error(`Refused with ${response.statusCode}`)),
      );
    });
    expect(JSON.parse(welcome)).toMatchObject({ type: "welcome" });
  });

  it("counts visitors on the production website too (LINTEL-FUNC-042)", async () => {
    const app = await start({
      publicSite: builtInPublicSite,
      website: { builtInSiteUrl: "https://example.com" },
    });
    await app.ready();
    await setEnabledPlugins(testDatabase.database, app.plugins, ["analytics"]);
    forgetAnalyticsTags();

    const home = await app.inject({ method: "GET", url: "/" });

    expect(home.body).toContain("/_lintel/api/analytics/script.js");
  });

  it("serves a site with only a path prefix (/ie) on the same domain", async () => {
    const app = await start({
      publicSite: builtInPublicSite,
      website: { builtInSiteUrl: "https://example.com" },
    });
    await ensurePagesCollection(testDatabase.database);
    await createTestUser(testDatabase.database, "owner@example.com", [["*"]]);
    const signIn = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in",
      payload: { email: "owner@example.com", password: TEST_PASSWORD },
    });
    const session = signIn.cookies.find((cookie) => cookie.name === SESSION_COOKIE_NAME);
    const cookies = { [SESSION_COOKIE_NAME]: session?.value ?? "" };
    const api = (method: "GET" | "POST", url: string, payload?: object) =>
      app.inject({ method, url: `/api${url}`, cookies, ...(payload ? { payload } : {}) });
    const created = await api("POST", "/sites", {
      handle: "ie",
      name: "Ireland",
      pathPrefix: "/ie",
      defaultLocale: "en-IE",
    });
    expect(created.statusCode, created.body).toBe(201);
    const page = await api("POST", "/collections/pages/entries?site=ie", {
      data: { title: "Irish home" },
    });
    expect(page.statusCode, page.body).toBe(201);
    await api("POST", `/entries/${page.json().id}/publish?site=ie`);

    const home = await app.inject({ method: "GET", url: "/ie", headers: { host: "example.com" } });
    expect(home.statusCode).toBe(200);
    expect(home.body).toContain("Irish home");
    const other = await app.inject({ method: "GET", url: "/", headers: { host: "example.com" } });
    expect(other.body).not.toContain("Irish home");
  });

  it("answers the website, the admin and the API on one listening port", async () => {
    const app = await start({
      publicSite: builtInPublicSite,
      website: { builtInSiteUrl: "https://example.com" },
    });
    await app.listen({ port: 0, host: "127.0.0.1" });
    const origin = `http://127.0.0.1:${app.addresses()[0]?.port}`;

    const website = await fetch(`${origin}/`);
    expect(await website.text()).toContain("This website has no home page yet");
    expect(await (await fetch(`${origin}/admin/content`)).text()).toContain("lintel-admin");
    expect((await (await fetch(`${origin}/api/setup/status`)).json()).needsSetup).toBe(true);
    expect((await fetch(`${origin}/health`)).status).toBe(200);
    // Any other address belongs to the website, even ones that look like the API's routes.
    const notApi = await fetch(`${origin}/setup/status`);
    expect(notApi.status).toBe(404);
    expect(notApi.headers.get("content-type")).toContain("text/html");
  });

  it("links emails to the admin under its path (LINTEL-FUNC-041)", async () => {
    const app = await start();
    expect(app.adminUrl).toBe("https://example.com/admin");
  });

  it("serves the API under /api, with health checks at the root", async () => {
    const app = await start();

    const setupStatus = await app.inject({ method: "GET", url: "/api/setup/status" });
    expect(setupStatus.statusCode).toBe(200);
    expect(setupStatus.headers["cache-control"]).toBe("no-store");
    expect((await app.inject({ method: "GET", url: "/setup/status" })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: "/health" })).json()).toEqual({ status: "ok" });
    expect((await app.inject({ method: "GET", url: "/ready" })).statusCode).toBe(200);
  });

  it("serves the admin at every address under its path, telling it where it is", async () => {
    const app = await start({ adminPath: "/cms" });

    for (const url of ["/cms", "/cms/", "/cms/content/pages"]) {
      const page = await app.inject({ method: "GET", url });
      expect(page.statusCode, url).toBe(200);
      expect(page.headers["cache-control"]).toBe("no-cache");
      expect(page.body).toContain('<head><base href="/cms/" />');
      expect(page.body).toContain(
        '<meta name="lintel-admin" content="{&quot;basePath&quot;:&quot;/cms&quot;,&quot;apiUrl&quot;:&quot;/api&quot;}" />',
      );
    }
  });

  it("caches the admin's fingerprinted files for a year, and other files for an hour", async () => {
    const app = await start();

    const script = await app.inject({ method: "GET", url: "/admin/assets/index-a1b2c3d4.js" });
    expect(script.statusCode).toBe(200);
    expect(script.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
    const icon = await app.inject({ method: "GET", url: "/admin/favicon.svg" });
    expect(icon.headers["cache-control"]).toBe("public, max-age=3600");
  });

  it("explains a missing admin build instead of showing a blank page", async () => {
    const app = await start({ adminBuildFolder: join(folder, "not-built") });

    const page = await app.inject({ method: "GET", url: "/admin" });
    expect(page.statusCode).toBe(503);
    expect(page.body).toContain("pnpm build");
  });

  it("shows a placeholder website until a site renderer is plugged in", async () => {
    const app = await start();

    const home = await app.inject({ method: "GET", url: "/" });
    expect(home.statusCode).toBe(200);
    expect(home.body).toContain("This website is on its way");
    expect(home.body).toContain('href="/admin"');
  });

  it("lets a site renderer take over the website", async () => {
    const app = await start({
      publicSite: async (site, options) => {
        site.get("/*", async () => `Rendered page, API at ${options.apiPrefix}`);
      },
    });

    expect((await app.inject({ method: "GET", url: "/about" })).body).toBe(
      "Rendered page, API at /api",
    );
    expect((await app.inject({ method: "GET", url: "/admin" })).body).toContain("lintel-admin");
  });

  it("compresses responses for browsers that accept it", async () => {
    const app = await start();

    const page = await app.inject({
      method: "GET",
      url: "/api/openapi.json",
      headers: { "accept-encoding": "gzip" },
    });
    expect(page.headers["content-encoding"]).toBe("gzip");
    expect(JSON.parse(gunzipSync(page.rawPayload).toString()).openapi).toBeDefined();
  });

  it("believes the proxy in front about the visitor's address and HTTPS", async () => {
    const app = await start();
    app.get("/whoami", async (request) => ({ ip: request.ip, protocol: request.protocol }));

    const response = await app.inject({
      method: "GET",
      url: "/whoami",
      headers: { "x-forwarded-for": "203.0.113.7", "x-forwarded-proto": "https" },
    });
    expect(response.json()).toEqual({ ip: "203.0.113.7", protocol: "https" });
  });

  it("gives every response a request id, keeping a safe one from the proxy", async () => {
    const app = await start();

    const fromProxy = await app.inject({
      method: "GET",
      url: "/health",
      headers: { "x-request-id": "caddy-42" },
    });
    expect(fromProxy.headers["x-request-id"]).toBe("caddy-42");
    const odd = await app.inject({
      method: "GET",
      url: "/health",
      headers: { "x-request-id": "<script>" },
    });
    expect(odd.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("logs JSON lines with the request id, and never the cookies", async () => {
    const lines: Record<string, unknown>[] = [];
    const stream = new Writable({
      write(chunk: Buffer, _encoding, done) {
        lines.push(JSON.parse(chunk.toString()) as Record<string, unknown>);
        done();
      },
    });
    const options = productionLoggerOptions("info");
    const app = await start({
      logger: typeof options === "object" ? { ...options, stream } : options,
    });

    app.get("/log-headers", async (request) => {
      request.log.info({ headers: request.headers }, "Headers seen");
      return "ok";
    });
    await app.inject({
      method: "GET",
      url: "/log-headers",
      headers: { cookie: "lintel_session=secret", "x-request-id": "trace-1" },
    });

    const logged = lines.find((line) => line.msg === "Headers seen");
    expect(logged).toMatchObject({ requestId: "trace-1", service: "lintel" });
    expect(JSON.stringify(lines)).not.toContain("secret");
    expect(JSON.stringify(logged)).toContain("[hidden]");
  });
});
