import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_EMAIL_FROM } from "../email/email.config.js";
import { createEmailSender, OutboxEmailDriver } from "../email/index.js";
import { useTestDatabase } from "../testing/test-database.js";
import { createPersonWithRole } from "../testing/test-people.js";
import {
  fetchServing,
  makeTestRelease,
  makeTestReleaseKey,
  type TestRelease,
} from "../testing/test-releases.js";
import { requestsAs, startTestServer } from "../testing/test-server.js";
import { signInAndGetCookies } from "../testing/test-users.js";
import { pointCurrentAt, versionFolder } from "./install-home.js";
import type { SwitchRequest } from "./supervisor/supervisor-messages.js";
import { checkForUpdatesIfDue } from "./update-checks.service.js";
import type { UpdatesOverview } from "./updates.service.js";
import { updateChecksContextFor } from "./updates.service.js";
import type { InstallType, UpdateProgress } from "./updates.schema.js";

const FEED_URL = "https://feed.test/releases";

describe("Settings → Updates", { timeout: 60_000 }, () => {
  const testDatabase = useTestDatabase();
  const key = makeTestReleaseKey();
  let folder: string;
  let server: FastifyInstance;
  let outbox: OutboxEmailDriver;
  let asked: SwitchRequest[];
  let feedRequests: number;
  let feedIsDown: boolean;
  let releases: TestRelease[];

  async function startServer(installType: InstallType = "supervised") {
    await server?.close();
    server = await startTestServer(testDatabase.activeDatabase, {
      email: createEmailSender(outbox, { defaultFrom: DEFAULT_EMAIL_FROM }),
      dataTools: {
        backupsFolder: join(folder, "backups"),
        importsFolder: join(folder, "imports"),
      },
      updates: {
        installType,
        currentVersion: "1.0.0",
        feedUrl: FEED_URL,
        publicKey: key.publicKey,
        home: join(folder, "home"),
        installFolder: join(folder, "home", "versions", "1.0.0"),
        sendToSupervisor: (request) => void asked.push(request),
        fetch: fetchServing(releases, (url) => {
          if (url !== FEED_URL) return undefined;
          feedRequests += 1;
          if (feedIsDown) return new Response("rate limited", { status: 403 });
          return Response.json(
            releases.map(({ release }) => ({
              tag_name: `v${release.version}`,
              name: release.name,
              body: release.security ? "Security: yes\n\nFixes a sign-in problem." : "New things.",
              prerelease: release.version.includes("-"),
              assets: release.assets.map((asset) => ({
                name: asset.name,
                browser_download_url: asset.url,
                size: asset.size,
              })),
            })),
          );
        }),
      },
    });
  }

  async function as(email: string, role: string) {
    await createPersonWithRole(testDatabase.database, email, role, role);
    return requestsAs(server, await signInAndGetCookies(server, email));
  }

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "lintel-updates-"));
    outbox = new OutboxEmailDriver();
    asked = [];
    feedRequests = 0;
    feedIsDown = false;
    releases = [
      await makeTestRelease(key, "1.1.0", { security: true }),
      await makeTestRelease(key, "1.2.0-beta.1"),
    ];
    await mkdir(versionFolder(join(folder, "home"), "1.0.0"), { recursive: true });
    await writeFile(
      join(versionFolder(join(folder, "home"), "1.0.0"), "release.json"),
      JSON.stringify({ version: "1.0.0" }),
    );
    await pointCurrentAt(join(folder, "home"), versionFolder(join(folder, "home"), "1.0.0"));
    await startServer();
  });

  afterEach(async () => {
    await server.close();
    await rm(folder, { recursive: true, force: true });
  });

  it("lets owners and admins see updates, and nobody else", async () => {
    const owner = await as("owner@example.com", "owner");
    const admin = await as("admin@example.com", "admin");
    const editor = await as("editor@example.com", "editor");

    expect((await owner("GET", "/updates")).statusCode).toBe(200);
    expect((await admin("GET", "/updates")).statusCode).toBe(200);
    expect((await editor("GET", "/updates")).statusCode).toBe(403);
    expect((await editor("GET", "/updates/summary")).statusCode).toBe(403);
    expect((await editor("GET", "/about")).json()).toEqual({ version: "1.0.0" });
    expect((await server.inject({ url: "/about" })).statusCode).toBe(401);
  });

  it("checks the feed and lists newer stable versions, with the security count", async () => {
    const admin = await as("admin@example.com", "admin");

    const overview = (await admin("POST", "/updates/check")).json<UpdatesOverview>();

    expect(feedRequests).toBe(1);
    expect(overview.releases.map((release) => release.version)).toEqual(["1.1.0"]);
    expect(overview).toMatchObject({
      currentVersion: "1.0.0",
      recommendedVersion: "1.1.0",
      summary: { count: 1, securityCount: 1 },
      method: { installType: "supervised", oneClick: true },
      canInstall: false,
      problem: null,
    });
    expect(overview.installedVersions).toEqual([
      expect.objectContaining({ version: "1.0.0", current: true }),
    ]);

    await admin("PUT", "/updates/preferences", { channel: "beta" });
    const withBetas = (await admin("GET", "/updates")).json<UpdatesOverview>();
    expect(withBetas.releases.map((release) => release.version)).toEqual(["1.2.0-beta.1", "1.1.0"]);
    expect((await admin("GET", "/updates/summary")).json()).toEqual({ count: 2, securityCount: 1 });
  });

  it("emails owners once about a new security release", async () => {
    await createPersonWithRole(testDatabase.database, "owner@example.com", "owner", "Olu");
    await createPersonWithRole(testDatabase.database, "admin@example.com", "admin", "Ada");
    const context = updateChecksContextFor(server);

    expect(await checkForUpdatesIfDue(context)).toBe(true);
    expect(await checkForUpdatesIfDue(context)).toBe(false);
    const tomorrow = new Date(Date.now() + 25 * 60 * 60 * 1000);
    expect(await checkForUpdatesIfDue(context, tomorrow)).toBe(true);

    expect(outbox.sent.map((email) => email.to)).toEqual([["owner@example.com"]]);
    expect(outbox.sent[0]?.subject).toBe("Security update for Lintel: 1.1.0");
    expect(outbox.sent[0]?.text).toContain("http://localhost:5173/settings/updates");
  });

  it("says plainly when the feed can't be reached, and keeps what it knew", async () => {
    const admin = await as("admin@example.com", "admin");
    await admin("POST", "/updates/check");
    feedIsDown = true;

    const overview = (await admin("POST", "/updates/check")).json<UpdatesOverview>();
    expect(overview.problem).toContain("couldn't reach the update feed");
    expect(overview.releases.map((release) => release.version)).toEqual(["1.1.0"]);
  });

  it("only lets owners update, after confirming, and logs it in the security log", async () => {
    const admin = await as("admin@example.com", "admin");
    const owner = await as("owner@example.com", "owner");
    await owner("POST", "/updates/check");

    expect(
      (await admin("POST", "/updates/install", { version: "1.1.0", confirmed: true })).json(),
    ).toMatchObject({
      code: "OWNERS_ONLY",
    });
    expect((await owner("POST", "/updates/install", { version: "1.1.0" })).statusCode).toBe(400);
    expect(
      (await owner("POST", "/updates/install", { version: "9.0.0", confirmed: true })).statusCode,
    ).toBe(404);

    const started = await owner("POST", "/updates/install", { version: "1.1.0", confirmed: true });
    expect(started.statusCode).toBe(202);
    expect(started.json<UpdateProgress>().step).toBe("backing-up");
    expect(
      (await owner("POST", "/updates/install", { version: "1.1.0", confirmed: true })).statusCode,
    ).toBe(409);

    await expect.poll(() => asked.length, { timeout: 30_000 }).toBe(1);
    expect(asked[0]).toMatchObject({ kind: "update", version: "1.1.0", restoreBackupFirst: false });
    expect(asked[0]?.backupFile).toMatch(/lintel-backup-.*\.zip$/);
    const progress = (await owner("GET", "/updates/progress")).json<{ progress: UpdateProgress }>();
    expect(progress.progress).toMatchObject({ step: "maintenance", version: "1.1.0" });
    expect((await admin("GET", "/updates/status")).json()).toEqual({
      updating: true,
      version: "1.1.0",
    });

    const log = (await owner("GET", "/security-log?kind=lintel-update-started")).json<{
      events: Array<{ kind: string; details: Record<string, unknown> }>;
    }>();
    expect(log.events).toEqual([
      expect.objectContaining({
        kind: "lintel-update-started",
        details: { from: "1.0.0", to: "1.1.0" },
      }),
    ]);
  });

  it("reports a tampered download as a failure and asks nothing of the supervisor", async () => {
    releases = [await makeTestRelease(key, "1.1.0", { tamperWithBuild: true })];
    await startServer();
    const owner = await as("owner@example.com", "owner");
    await owner("POST", "/updates/check");

    await owner("POST", "/updates/install", { version: "1.1.0", confirmed: true });

    await expect
      .poll(
        async () =>
          (await owner("GET", "/updates/progress")).json<{ progress: UpdateProgress }>().progress
            .step,
        {
          timeout: 30_000,
        },
      )
      .toBe("failed");
    expect(asked).toEqual([]);
  });

  it("explains instead of updating on installs that can't update themselves", async () => {
    await startServer("source");
    const owner = await as("owner@example.com", "owner");
    await owner("POST", "/updates/check");

    const overview = (await owner("GET", "/updates")).json<UpdatesOverview>();
    expect(overview.method).toEqual({
      installType: "source",
      oneClick: false,
      commands: ["pnpm lintel update --to {version}"],
    });
    expect(overview.installedVersions).toEqual([]);
    const refused = await owner("POST", "/updates/install", { version: "1.1.0", confirmed: true });
    expect(refused.json()).toMatchObject({ code: "ONE_CLICK_NOT_AVAILABLE" });
  });

  it("rolls back to a version kept on disk, for owners only", async () => {
    await mkdir(versionFolder(join(folder, "home"), "0.9.0"), { recursive: true });
    await writeFile(
      join(versionFolder(join(folder, "home"), "0.9.0"), "release.json"),
      JSON.stringify({ version: "0.9.0" }),
    );
    const admin = await as("admin@example.com", "admin");
    const owner = await as("owner@example.com", "owner");
    const body = { version: "0.9.0", restoreBackup: false, confirmed: true };

    expect((await admin("POST", "/updates/rollback", body)).statusCode).toBe(403);
    expect(
      (await owner("POST", "/updates/rollback", { ...body, version: "1.0.0" })).statusCode,
    ).toBe(409);
    expect(
      (await owner("POST", "/updates/rollback", { ...body, version: "0.1.0" })).statusCode,
    ).toBe(404);
    expect((await owner("POST", "/updates/rollback", body)).statusCode).toBe(202);
    expect(asked).toEqual([
      { kind: "rollback", version: "0.9.0", backupFile: null, restoreBackupFirst: false },
    ]);
  });
});
