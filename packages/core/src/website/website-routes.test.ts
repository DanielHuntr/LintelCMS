import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalDiskStorage } from "../media/local-disk-storage.js";
import { buildProductionServer } from "../production/production-server.js";
import { useTestDatabase } from "../testing/test-database.js";
import { startTestServer } from "../testing/test-server.js";
import { builtInPublicSite } from "./built-in-public-site.js";
import { buildSiteServer } from "./site-server.js";

const sourceFolder = fileURLToPath(new URL("..", import.meta.url));

/** Notes every route a server is given, once it starts up. */
function noteRoutes(server: FastifyInstance, routes: string[]) {
  server.addHook("onRoute", (route) => {
    const methods = Array.isArray(route.method) ? route.method : [route.method];
    for (const method of methods) routes.push(`${method} ${route.url}`);
  });
}

async function sourceFiles(folder: string): Promise<string[]> {
  const entries = await readdir(folder, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
    .filter((entry) => !entry.name.endsWith(".test.ts"))
    .map((entry) => join(entry.parentPath, entry.name));
}

/**
 * The website runs on two servers, and FUNC-042 came from wiring them up separately: the
 * production one lost the Visitors beacon, A/B reporting and Liquid templates without any
 * error. These tests fail if the two ever differ again (LINTEL-UX-332).
 */
describe("the website's two servers", () => {
  const testDatabase = useTestDatabase();
  let folder: string;
  const servers: FastifyInstance[] = [];

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "lintel-website-routes-"));
    await mkdir(join(folder, "admin"), { recursive: true });
    await writeFile(join(folder, "admin", "index.html"), "<!doctype html><title>Lintel</title>");
  });
  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
    await rm(folder, { recursive: true, force: true });
  });

  it("serve exactly the same routes in development and production", async () => {
    const developmentRoutes: string[] = [];
    const api = await startTestServer(testDatabase.activeDatabase, {
      website: { builtInSiteUrl: "http://localhost:3999" },
    });
    const development = buildSiteServer({ api });
    servers.push(api, development);
    noteRoutes(development, developmentRoutes);
    await development.ready();

    const productionRoutes: string[] = [];
    const production = buildProductionServer({
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
      website: { builtInSiteUrl: "https://example.com" },
      publicSite: async (site, options) => {
        noteRoutes(site, productionRoutes);
        await builtInPublicSite(site, options);
      },
    });
    servers.push(production);
    await production.ready();

    expect(developmentRoutes.length).toBeGreaterThan(0);
    expect(productionRoutes.sort()).toEqual(developmentRoutes.sort());
  });

  it("are wired up in one place only", async () => {
    const wiring = [
      "siteRoutes",
      "siteApiRoutes",
      "testCheckoutSiteRoutes",
      "experimentSiteRoutes",
    ];
    const registers = new RegExp(`\\.register\\(\\s*(${wiring.join("|")})\\b`);

    const wiredIn: string[] = [];
    for (const file of await sourceFiles(sourceFolder)) {
      if (registers.test(await readFile(file, "utf8"))) wiredIn.push(file);
    }

    expect(wiredIn).toEqual([join(sourceFolder, "website", "website-routes.ts")]);
  });
});
