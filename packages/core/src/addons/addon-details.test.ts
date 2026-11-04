import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { rowsOf } from "../backups/database-snapshot.repository.js";
import { buildServer } from "../server.js";
import { useTestDatabase } from "../testing/test-database.js";
import { requestsAs, type SendRequest } from "../testing/test-server.js";
import { createTestUser } from "../testing/test-users.js";
import { signInAndGetCookies } from "../testing/test-users.js";
import { writeAddonsList } from "./addons-list.js";
import { type AddonsState, loadAddons } from "./load-addons.js";

/**
 * One add-on in full on Build → Add-ons: what it says it keeps and does, set against what
 * Lintel finds for itself, and exporting and deleting its data.
 */

const server = `
const { definePlugin } = globalThis.__lintelAddonModules["@lintel/core/plugin"];
const { z } = globalThis.__lintelAddonModules["zod"];
export default definePlugin({
  id: "postcards",
  name: "Postcards",
  description: "Send a postcard from any page.",
  settings: { schema: z.object({ greeting: z.string().default("Hi") }), defaults: { greeting: "Hi" } },
  routes(scope) {
    scope.get("/postcards/latest", async () => ({ latest: null }));
    scope.post("/postcards/send", async () => ({ sent: true }));
  },
  events: { "form.submitted": async () => {} },
  jobs: [{ id: "send", name: "Sending postcards", everyMinutes: 60, run: async () => {} }],
  consentServices: [{ handle: "stamps", name: "Stamp Co" }],
});
`;

const manifest = {
  id: "postcards",
  lintel: ">=1.0.0-rc.1",
  personalData: {
    tables: [{ name: "guestbook_signups", columns: [{ name: "email", personalData: true }] }],
  },
  tables: [
    {
      name: "postcards_sent",
      purpose: "Postcards visitors sent.",
      columns: [
        { name: "sender_email", purpose: "Who sent it.", personalData: true },
        { name: "message", purpose: "What it says." },
        { name: "stamp", purpose: "A column it no longer has." },
      ],
    },
  ],
  publicRoutes: [
    { method: "GET", path: "/postcards/latest", purpose: "The newest postcard, for the site." },
    { method: "GET", path: "/postcards/gone", purpose: "Something it doesn't add." },
  ],
  jobs: [{ id: "send", purpose: "Posts the postcards waiting to go." }],
  events: [{ event: "form.submitted", purpose: "Makes a postcard from a sent form." }],
  hosts: [{ host: "api.stamp.example", purpose: "Buys the stamps." }],
};

describe("an add-on's details", () => {
  const testDatabase = useTestDatabase();
  let root: string;
  let addons: AddonsState;
  let api: FastifyInstance;
  let owner: SendRequest;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "lintel-addon-details-"));
    const addonsFolder = join(root, "addons");
    const installed = join(addonsFolder, "node_modules", "@example", "lintel-postcards");
    await mkdir(join(installed, "dist"), { recursive: true });
    await writeFile(
      join(installed, "package.json"),
      JSON.stringify({
        name: "@example/lintel-postcards",
        version: "2.1.0",
        license: "MIT",
        author: { name: "Example Studio" },
        repository: { url: "git+https://github.com/example/lintel-postcards.git" },
        "lintel-addon": manifest,
      }),
    );
    await writeFile(join(installed, "dist", "server.js"), server);
    await writeFile(
      join(addonsFolder, "package-lock.json"),
      JSON.stringify({
        packages: { "node_modules/@example/lintel-postcards": { integrity: "sha512-abc" } },
      }),
    );
    await writeAddonsList(addonsFolder, {
      packages: ["@example/lintel-postcards"],
      linked: [],
      enableOnStart: [],
    });
    addons = await loadAddons(addonsFolder, { lintelVersion: "1.0.0-rc.4", takenIds: [] });
  });

  beforeEach(async () => {
    api = buildServer({
      adminOrigin: "http://localhost:5173",
      database: testDatabase.activeDatabase,
      runScheduledJobs: false,
      addons,
    });
    await api.ready();
    const database = testDatabase.database;
    await database.execute(
      sql`drop table if exists postcards_sent, postcards_drafts, guestbook_signups`,
    );
    await database.execute(
      sql`create table guestbook_signups (id varchar(64) primary key, email text)`,
    );
    await database.execute(
      sql`create table postcards_sent (id varchar(64) primary key, sender_email text, message text)`,
    );
    await database.execute(sql`create table postcards_drafts (id varchar(64) primary key)`);
    await database.execute(
      sql`insert into postcards_sent values ('p1', 'ann@example.com', 'Hello, "friend"')`,
    );
    await database.execute(sql`insert into guestbook_signups values ('g1', 'gus@example.com')`);
    await createTestUser(database, "owner@example.com", [["*"]]);
    owner = requestsAs(api, await signInAndGetCookies(api, "owner@example.com"));
  });

  afterEach(() => api.close());
  afterAll(() => rm(root, { recursive: true, force: true }));

  it("labels a table named only under personalData as personal", async () => {
    const details = (await owner("GET", "/addons/postcards/details")).json();

    const table = details.stores.tables.find(
      (candidate: { name: string }) => candidate.name === "guestbook_signups",
    );
    expect(table).toMatchObject({
      checked: true,
      columns: [{ name: "email", personalData: true, checked: true }],
    });
    expect(details.stores.undeclared).toMatchObject([{ name: "postcards_drafts" }]);
  });

  it("sets what it says it keeps and does against what Lintel finds", async () => {
    const response = await owner("GET", "/addons/postcards/details");
    expect(response.statusCode, response.body).toBe(200);
    const details = response.json();

    const [sent] = details.stores.tables;
    expect(sent).toMatchObject({ name: "postcards_sent", checked: true, rows: 1 });
    expect(sent.bytes).toBeGreaterThan(0);
    expect(sent.columns).toEqual([
      { name: "sender_email", purpose: "Who sent it.", personalData: true, checked: true },
      { name: "message", purpose: "What it says.", personalData: false, checked: true },
      { name: "stamp", purpose: "A column it no longer has.", personalData: false, checked: false },
    ]);
    // A table with its name it doesn't describe is found, so the screen can warn.
    expect(details.stores.undeclared).toMatchObject([{ name: "postcards_drafts", rows: 0 }]);
    expect(details.stores.settings).toBe(true);

    expect(details.website.publicRoutes).toEqual([
      { ...manifest.publicRoutes[0], checked: true },
      { ...manifest.publicRoutes[1], checked: false },
    ]);
    expect(details.website.otherRoutes).toBe(1);
    expect(details.runs.jobs).toEqual([
      {
        id: "send",
        name: "Sending postcards",
        everyMinutes: 60,
        purpose: "Posts the postcards waiting to go.",
        lastRunAt: null,
        lastError: null,
        checked: true,
      },
    ]);
    expect(details.runs.events).toEqual([
      { event: "form.submitted", purpose: "Makes a postcard from a sent form.", checked: true },
    ]);
    expect(details.talksTo).toEqual({
      hosts: manifest.hosts,
      consentServices: ["Stamp Co"],
      consentFromSettings: false,
    });
    expect(details.origin).toMatchObject({
      packageName: "@example/lintel-postcards",
      version: "2.1.0",
      publisher: "Example Studio",
      licence: "MIT",
      source: "https://github.com/example/lintel-postcards",
      integrity: "sha512-abc",
    });
    expect(details.origin.fingerprint).toMatch(/^sha256-[0-9a-f]{64}$/);
  });

  it("exports its data as JSON, or one table as CSV", async () => {
    const json = await owner("GET", "/addons/postcards/export?format=json");
    expect(json.statusCode).toBe(200);
    expect(json.headers["content-disposition"]).toContain("postcards-data.json");
    expect(json.json().tables).toEqual({
      postcards_sent: [{ id: "p1", sender_email: "ann@example.com", message: 'Hello, "friend"' }],
      guestbook_signups: [{ id: "g1", email: "gus@example.com" }],
      postcards_drafts: [],
    });

    const csv = await owner("GET", "/addons/postcards/export?format=csv&table=postcards_sent");
    expect(csv.body).toBe('id,sender_email,message\r\np1,ann@example.com,"Hello, ""friend"""\r\n');
    const elsewhere = await owner("GET", "/addons/postcards/export?format=csv&table=users");
    expect(elsewhere.statusCode).toBe(404);
  });

  it("stops a spreadsheet running what a visitor typed into an add-on's table", async () => {
    await testDatabase.database.execute(
      sql`insert into postcards_sent values ('p2', 'ben@example.com', '=HYPERLINK("x")')`,
    );
    const csv = await owner("GET", "/addons/postcards/export?format=csv&table=postcards_sent");
    expect(csv.body).toContain(`"'=HYPERLINK(""x"")"`);
  });

  it("deletes its data only once it is off, leaving its tables empty", async () => {
    await owner("PUT", "/plugins", { enabled: ["postcards"] });
    const refused = await owner("POST", "/addons/postcards/delete-data", { confirm: "DELETE" });
    expect(refused.statusCode).toBe(409);
    expect(refused.json().message).toBe("Switch Postcards off before deleting its data.");

    await owner("PUT", "/plugins", { enabled: [] });
    const unconfirmed = await owner("POST", "/addons/postcards/delete-data", {});
    expect(unconfirmed.statusCode).toBe(400);
    const deleted = await owner("POST", "/addons/postcards/delete-data", { confirm: "DELETE" });
    expect(deleted.json()).toEqual({
      emptied: ["postcards_sent", "guestbook_signups", "postcards_drafts"],
    });
    const signups = await testDatabase.database.execute(
      sql`select count(*) as count from guestbook_signups`,
    );
    expect(Number(rowsOf(signups)[0]?.count)).toBe(0);
    const left = await testDatabase.database.execute(
      sql`select count(*) as count from postcards_sent`,
    );
    expect(Number(rowsOf(left)[0]?.count)).toBe(0);
  });

  it("needs settings:read to look, and settings:update to export or delete", async () => {
    await createTestUser(testDatabase.database, "viewer@example.com", [["settings:read"]]);
    const viewer = requestsAs(api, await signInAndGetCookies(api, "viewer@example.com"));
    expect((await viewer("GET", "/addons/postcards/details")).statusCode).toBe(200);
    expect((await viewer("GET", "/addons/postcards/export")).statusCode).toBe(403);
    expect(
      (await viewer("POST", "/addons/postcards/delete-data", { confirm: "DELETE" })).statusCode,
    ).toBe(403);
    expect((await owner("GET", "/addons/nothing/details")).statusCode).toBe(404);
  });
});
