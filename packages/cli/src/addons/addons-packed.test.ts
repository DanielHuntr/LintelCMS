import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { installedPackageFolder, loadSiteAddons } from "@lintel/core/data-tools";
import { type PluginTestServer, startPluginTestServer } from "@lintel/core/plugin-testing";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { makeAddonsCommand } from "../commands/addons.js";
import type { Terminal } from "../terminal.js";
import { buildAddon } from "./addon-build.js";
import { runNpm } from "./addon-install.js";

/**
 * Lintel's add-ons with tables, as a site gets them: built, packed by npm, installed with
 * `lintel addons add` and run from the installed files on a real database server. Run by
 * `pnpm test:addons`, which names the database in LINTEL_PACKED_ADDONS_URL.
 */

const REPOSITORY_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const ADMIN_PACKAGES = join(REPOSITORY_ROOT, "packages", "admin", "node_modules");
const PICTURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 255, 39, 92, 1]);
const BREVO_KEY = "xkeysib-good-key-a1b2";

const ADDONS = [
  { folder: "addon-newsletter", packageName: "@lintel/addon-newsletter", id: "newsletter" },
  { folder: "addon-instagram", packageName: "@lintel/addon-instagram", id: "instagram" },
  {
    folder: "plugin-example-bookings",
    packageName: "@lintel/plugin-example-bookings",
    id: "bookings",
  },
];

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
}

/** Instagram and Brevo, as far as these tests reach them. */
const fakeServices: typeof fetch = async (input) => {
  const address = new URL(String(input));
  if (address.hostname === "pictures.example") {
    return new Response(PICTURE, { headers: { "content-type": "image/jpeg" } });
  }
  if (address.hostname === "api.brevo.com") {
    if (address.pathname === "/v3/contacts/lists") {
      return json({ lists: [{ id: 7, name: "Customers" }], count: 1 });
    }
    return new Response(null, { status: 204 });
  }
  if (address.pathname === "/me") return json({ user_id: "1784", username: "flourandoven" });
  if (address.pathname === "/me/media") {
    return json({
      data: [
        {
          id: "post-1",
          caption: "Fresh bread",
          media_type: "IMAGE",
          timestamp: "2026-11-01T09:00:00+0000",
          permalink: "https://www.instagram.com/p/post-1/",
          media_url: "https://pictures.example/post-1.jpg",
        },
      ],
    });
  }
  return new Response("{}", { status: 404 });
};

const databaseUrl = process.env.LINTEL_PACKED_ADDONS_URL;

describe.skipIf(!databaseUrl)("Lintel's add-ons installed from a packed .tgz", () => {
  let folder: string;
  let lintel: PluginTestServer;
  let asOwner: Awaited<ReturnType<PluginTestServer["signInWith"]>>;

  beforeAll(async () => {
    folder = await mkdtemp(join(tmpdir(), "lintel-packed-addons-"));
    const terminal: Terminal = {
      say: () => {},
      warn: () => {},
      ask: async () => "",
      workingFolder: folder,
    };
    const command = makeAddonsCommand({ npm: runNpm, folder: () => join(folder, "addons") });
    for (const { folder: packageFolder } of ADDONS) {
      const source = join(REPOSITORY_ROOT, "packages", packageFolder);
      await buildAddon(source, { watch: false, terminal, nodePaths: [ADMIN_PACKAGES] });
      const packed = join(folder, "packed", packageFolder);
      mkdirSync(packed, { recursive: true });
      const pack = spawnSync("npm", ["pack", "--pack-destination", packed], {
        cwd: source,
        shell: process.platform === "win32",
        encoding: "utf8",
      });
      expect(pack.status, pack.stderr).toBe(0);
      const tarball = readdirSync(packed).find((name) => name.endsWith(".tgz"));
      expect(await command.run(["add", join(packed, tarball ?? "")], terminal)).toBe(0);
    }

    const addons = await loadSiteAddons(folder, []);
    expect(addons.problems).toEqual([]);
    vi.stubGlobal("fetch", fakeServices);
    process.env.TEST_DATABASE_URL = databaseUrl;
    lintel = await startPluginTestServer({ plugins: addons.loaded.map(({ plugin }) => plugin) });
    asOwner = await lintel.signInWith(["*"]);
  }, 300_000);

  afterAll(async () => {
    delete process.env.TEST_DATABASE_URL;
    vi.unstubAllGlobals();
    await lintel?.close();
    await rm(folder, { recursive: true, force: true });
  });

  it("brings its MySQL migrations with it, and can run here", async () => {
    for (const { packageName } of ADDONS) {
      const installed = installedPackageFolder(join(folder, "addons"), packageName);
      expect(existsSync(join(installed, "migrations-mysql", "meta", "_journal.json"))).toBe(true);
    }
    const { plugins } = (await asOwner({ method: "GET", url: "/plugins" })).json() as {
      plugins: { id: string; enabled: boolean; canRunHere: boolean }[];
    };
    for (const { id } of ADDONS) {
      expect(plugins.find((plugin) => plugin.id === id)).toMatchObject({
        enabled: true,
        canRunHere: true,
      });
    }
  });

  it("runs Bookings from the installed files", async () => {
    const made = await asOwner({
      method: "POST",
      url: "/bookings",
      payload: {
        customerName: "Grace Hopper",
        customerEmail: "grace@example.com",
        startsAt: "2026-11-02T10:00:00.000Z",
      },
    });
    expect(made.statusCode).toBe(201);
    expect(made.json()).toMatchObject({
      startsAt: "2026-11-02T10:00:00.000Z",
      durationMinutes: 60,
    });
    const listed = await asOwner({ method: "GET", url: "/bookings" });
    expect(listed.json().bookings).toHaveLength(1);
  });

  it("runs Newsletter from the installed files", async () => {
    const saved = await asOwner({
      method: "PUT",
      url: "/newsletter/connection",
      payload: { provider: "brevo", apiKey: BREVO_KEY, listId: "7", doubleOptIn: false },
    });
    expect(saved.statusCode, saved.body).toBe(200);
    const again = await asOwner({
      method: "PUT",
      url: "/newsletter/connection",
      payload: { provider: "brevo", listId: "7", doubleOptIn: false },
    });
    expect(again.statusCode, again.body).toBe(200);
    expect((await asOwner({ method: "GET", url: "/newsletter/connection" })).json()).toMatchObject({
      connected: true,
      provider: "brevo",
      listName: "Customers",
      doubleOptIn: false,
    });
  });

  it("runs Instagram from the installed files, keeping its pictures byte for byte", async () => {
    const connected = await asOwner({
      method: "PUT",
      url: "/instagram/account",
      payload: { accessToken: "IGAAexampleLongLivedToken1234" },
    });
    expect(connected.statusCode, connected.body).toBe(200);
    await lintel.runJob("instagram", "sync");

    const feed = await lintel.server.inject({
      method: "GET",
      url: "/delivery/add-ons/instagram/posts",
    });
    expect(feed.statusCode, feed.body).toBe(200);
    const [post] = (await asOwner({ method: "GET", url: "/instagram/posts" })).json().posts as {
      id: string;
      postedAt: string;
    }[];
    expect(post?.postedAt).toBe("2026-11-01T09:00:00.000Z");

    const picture = await lintel.server.inject({
      method: "GET",
      url: `/delivery/add-ons/instagram/images/${post?.id}`,
    });
    expect(picture.headers["content-type"]).toBe("image/jpeg");
    expect([...picture.rawPayload]).toEqual([...PICTURE]);
  });
});
