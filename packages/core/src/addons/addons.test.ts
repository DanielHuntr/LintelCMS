import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildServer } from "../server.js";
import { useTestDatabase } from "../testing/test-database.js";
import { createTestUser, signInAndGetCookies } from "../testing/test-users.js";
import { ADDONS_LIST_FILE, writeAddonsList } from "./addons-list.js";
import { type AddonsState, loadAddons } from "./load-addons.js";
import { isReadableRange, isVersionInRange } from "./version-range.js";

/**
 * Add-ons installed in a site's Lintel folder: loaded one by one at start, each one that
 * can't be used left out with a plain reason, and switched on when `lintel addons add`
 * asked for it. The fixtures are built add-ons, as `lintel addons build` writes them: they
 * read Lintel's own modules from the global Lintel fills in.
 */

const postcardsServer = `
const { definePlugin, escapeHtml } = globalThis.__lintelAddonModules["@lintel/core/plugin"];
const { z } = globalThis.__lintelAddonModules["zod"];
export default definePlugin({
  id: "postcards",
  name: "Postcards",
  description: "Send a postcard from any page.",
  settings: { schema: z.object({ greeting: z.string().default("Wish you were here") }), defaults: { greeting: "Wish you were here" } },
  liquid: { tags: [{ name: "postcards_card", render: () => "<p>" + escapeHtml("Hi") + "</p>" }] },
  jobs: [{ id: "send", name: "Sending postcards", everyMinutes: 10, run: async () => {} }],
});
`;

async function writeAddon(
  folder: string,
  manifest: Record<string, unknown>,
  files: Record<string, string>,
  packageName = "@example/lintel-postcards",
) {
  await mkdir(join(folder, "dist"), { recursive: true });
  await writeFile(
    join(folder, "package.json"),
    JSON.stringify({ name: packageName, version: "2.1.0", "lintel-addon": manifest }),
  );
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(folder, name), content);
  }
}

describe("add-ons", () => {
  const testDatabase = useTestDatabase();
  let root: string;
  let addonsFolder: string;
  let addons: AddonsState;
  let server: FastifyInstance;
  let cookies: Record<string, string>;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "lintel-addons-"));
    addonsFolder = join(root, "addons");
    const installed = join(addonsFolder, "node_modules", "@example", "lintel-postcards");
    await writeAddon(
      installed,
      { id: "postcards", lintel: ">=1.0.0-rc.1", admin: "dist/admin.js" },
      { "dist/server.js": postcardsServer, "dist/admin.js": "export default { id: 'postcards' };" },
    );
    const tooNew = join(root, "work", "too-new");
    await writeAddon(
      tooNew,
      { id: "too-new", lintel: ">=99.0.0" },
      { "dist/server.js": "export default {}" },
      "too-new",
    );
    const broken = join(root, "work", "broken");
    await writeAddon(
      broken,
      { id: "broken", lintel: "*" },
      { "dist/server.js": "throw new Error('Something went wrong inside');" },
      "broken",
    );
    const clash = join(root, "work", "clash");
    await writeAddon(
      clash,
      { id: "blog", lintel: "*" },
      { "dist/server.js": "export default {}" },
      "clash",
    );
    await writeAddonsList(addonsFolder, {
      packages: ["@example/lintel-postcards", "@example/never-installed"],
      linked: [tooNew, broken, clash],
      enableOnStart: ["postcards", "too-new"],
    });

    addons = await loadAddons(addonsFolder, {
      lintelVersion: "1.0.0-rc.4",
      takenIds: ["blog", "forms"],
    });
  });

  beforeEach(async () => {
    server = buildServer({
      adminOrigin: "http://localhost:5173",
      database: testDatabase.activeDatabase,
      runScheduledJobs: false,
      addons,
    });
    await server.ready();
    await createTestUser(testDatabase.database, "owner@example.com", [["*"]]);
    cookies = await signInAndGetCookies(server, "owner@example.com");
  });

  afterEach(() => server.close());

  afterAll(() => rm(root, { recursive: true, force: true }));

  it("loads the ones that work and says plainly why the others were left out", () => {
    expect(addons.loaded.map(({ plugin }) => plugin.id)).toEqual(["postcards"]);
    expect(addons.problems.map(({ name, message }) => [name, message])).toEqual([
      ["@example/never-installed", "It isn't installed. Add it again with lintel addons add."],
      [
        "too-new",
        "It works with Lintel >=99.0.0, and this is Lintel 1.0.0-rc.4. Look for a newer version of it.",
      ],
      ["broken", "It failed to load: Something went wrong inside"],
      ["clash", 'Another plugin already uses the id "blog".'],
    ]);
  });

  it("switches on at start the ones lintel addons add asked for, once they load", async () => {
    const plugins = await server.inject({ method: "GET", url: "/plugins", cookies });
    const postcards = plugins
      .json()
      .plugins.find((plugin: { id: string }) => plugin.id === "postcards");
    expect(postcards).toMatchObject({ enabled: true, source: "installed" });

    const list = JSON.parse(await readFile(join(addonsFolder, ADDONS_LIST_FILE), "utf8"));
    // The one that couldn't load waits to be switched on until it can.
    expect(list.enableOnStart).toEqual(["too-new"]);
  });

  it("lists every add-on with what it adds, its settings form and any problem", async () => {
    const response = await server.inject({ method: "GET", url: "/addons", cookies });

    expect(response.statusCode).toBe(200);
    const { addons: listed, folder } = response.json();
    expect(folder).toBe(addonsFolder);
    expect(listed[0]).toMatchObject({
      id: "postcards",
      name: "Postcards",
      packageName: "@example/lintel-postcards",
      version: "2.1.0",
      from: "npm",
      enabled: true,
      adds: ["liquid", "jobs", "settings", "admin"],
      problem: null,
    });
    expect(listed[0].settingsSchema).toMatchObject({
      type: "object",
      properties: { greeting: { type: "string", default: "Wish you were here" } },
    });
    expect(
      listed.slice(1).map(({ name, from }: { name: string; from: string }) => [name, from]),
    ).toEqual([
      ["@example/never-installed", "npm"],
      ["too-new", "folder"],
      ["broken", "folder"],
      ["clash", "folder"],
    ]);
  });

  it("needs settings:read to list them", async () => {
    const response = await server.inject({ method: "GET", url: "/addons" });
    expect(response.statusCode).toBe(401);
  });

  it("serves the admin halves for the admin to load", async () => {
    const scripts = await server.inject({ method: "GET", url: "/addons/admin-scripts" });
    expect(scripts.json().scripts).toEqual([
      {
        id: "postcards",
        script: expect.stringMatching(/^\/addons\/postcards\/admin\.js\?v=\d+$/),
        styles: null,
      },
    ]);

    const script = await server.inject({ method: "GET", url: "/addons/postcards/admin.js" });
    expect(script.statusCode).toBe(200);
    expect(script.headers["content-type"]).toBe("text/javascript; charset=utf-8");
    expect(script.body).toBe("export default { id: 'postcards' };");

    const missing = await server.inject({ method: "GET", url: "/addons/postcards/admin.css" });
    expect(missing.statusCode).toBe(404);
  });
});

describe("an add-on with no code (LINTEL-UX-287)", () => {
  const testDatabase = useTestDatabase();
  const personalData = {
    tables: [{ name: "votes_cast", columns: [{ name: "email", personalData: true }] }],
  };

  async function load(manifest: Record<string, unknown>, sourceFolder?: string) {
    const root = await mkdtemp(join(tmpdir(), "lintel-data-only-"));
    const folder = join(root, "work", "votes");
    await writeAddon(folder, { id: "votes", lintel: "*", ...manifest }, {}, "votes");
    if (sourceFolder) await mkdir(join(folder, sourceFolder), { recursive: true });
    await writeAddonsList(join(root, "addons"), {
      packages: [],
      linked: [folder],
      enableOnStart: [],
    });
    const state = await loadAddons(join(root, "addons"), {
      lintelVersion: "1.0.0-rc.4",
      takenIds: [],
    });
    await rm(root, { recursive: true, force: true });
    return state;
  }

  it("loads from package.json alone when it says what data it keeps", async () => {
    const { loaded, problems } = await load({ personalData });

    expect(problems).toEqual([]);
    expect(loaded[0]?.plugin).toMatchObject({
      id: "votes",
      name: "votes",
      description: "Says what data it keeps. It has no code of its own.",
    });
  });

  it("is listed as having no code, for the Add-ons screen (LINTEL-UX-338)", async () => {
    const server = buildServer({
      adminOrigin: "http://localhost:5173",
      database: testDatabase.activeDatabase,
      runScheduledJobs: false,
      addons: await load({ personalData }),
    });
    await server.ready();
    await createTestUser(testDatabase.database, "owner@example.com", [["*"]]);
    const cookies = await signInAndGetCookies(server, "owner@example.com");

    const response = await server.inject({ method: "GET", url: "/addons", cookies });
    await server.close();

    const listed = response.json().addons;
    expect(listed.find((addon: { id: string }) => addon.id === "votes").dataOnly).toBe(true);
    expect(listed.find((addon: { id: string }) => addon.id === "bookings")?.dataOnly).not.toBe(
      true,
    );
  });

  it.each([
    ["names a server file", { personalData, server: "dist/server.js" }, undefined],
    ["has server code to build", { personalData }, "src/server"],
    ["says nothing about data", {}, undefined],
  ])("is still told to build when it %s", async (_name, manifest, sourceFolder) => {
    const { loaded, problems } = await load(manifest, sourceFolder);

    expect(loaded).toEqual([]);
    expect(problems[0]?.message).toContain("Its server file (dist/server.js) is missing");
  });
});

describe("which Lintel versions an add-on works with", () => {
  it.each([
    ["1.0.0-rc.4", ">=1.0.0-rc.1", true],
    ["1.0.0-rc.1", ">=1.0.0-rc.2", false],
    ["1.4.0", "^1.0.0", true],
    ["2.0.0-rc.1", "^1.0.0", false],
    ["2.0.0", "^1.0.0", false],
    ["1.2.9", "~1.2.0", true],
    ["1.3.0", "~1.2.0", false],
    ["1.5.0", ">=1.0.0 <2.0.0", true],
    ["2.5.0", "^1.0.0 || ^2.0.0", true],
    ["3.0.0", "*", true],
    ["1.0.0", "1.0.0", true],
    ["1.0.0", "banana", false],
  ])("Lintel %s and %s: %s", (version, range, expected) => {
    expect(isVersionInRange(version, range)).toBe(expected);
  });

  it("refuses ranges it can't read, so a typo never lets an add-on in", () => {
    expect(isReadableRange(">=1.0.0-rc.1")).toBe(true);
    expect(isReadableRange(">=one")).toBe(false);
    expect(isReadableRange("")).toBe(false);
  });
});
