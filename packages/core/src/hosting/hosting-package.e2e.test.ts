import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildHostingPackage } from "./build-hosting-package.js";

/**
 * The whole shared-hosting path, as a person with cPanel would take it: make the zip,
 * extract it into an empty folder, `npm install --omit=dev`, `node app.js`, and open the
 * setup wizard and the website on the same port.
 *
 * It needs `pnpm build` first and downloads packages from npm, so it only runs with
 * LINTEL_HOSTING_E2E=1.
 */
const enabled = process.env.LINTEL_HOSTING_E2E === "1";
const PORT = 4917;
const ORIGIN = `http://localhost:${PORT}`;

describe.skipIf(!enabled)("the hosting package, from zip to a running site", () => {
  let folder: string;
  let appFolder: string;
  let lintel: ChildProcess | undefined;
  let log = "";

  beforeAll(async () => {
    folder = await mkdtemp(join(tmpdir(), "lintel-hosting-e2e-"));
    const zipFile = await buildHostingPackage();
    execFileSync("unzip", ["-q", zipFile, "-d", folder]);
    appFolder = join(folder, "lintel");
    execFileSync("npm", ["install", "--omit=dev", "--no-audit", "--no-fund"], {
      cwd: appFolder,
      stdio: "inherit",
      // npm is npm.cmd on Windows, which only a shell can start.
      shell: process.platform === "win32",
      timeout: 600_000,
    });
  }, 900_000);

  afterAll(async () => {
    if (lintel && lintel.exitCode === null) {
      lintel.kill("SIGTERM");
      await new Promise((resolve) => lintel?.once("exit", resolve));
    }
    await rm(folder, { recursive: true, force: true });
  }, 60_000);

  it("has a plain package.json npm can install from, and no workspace links", async () => {
    const manifest = JSON.parse(await readFile(join(appFolder, "package.json"), "utf8"));
    expect(manifest.type).toBeUndefined();
    expect(manifest.main).toBe("app.js");
    expect(manifest.workspaces).toBeUndefined();
    expect(Object.values(manifest.dependencies)).not.toContainEqual(
      expect.stringMatching(/^workspace:/),
    );
    expect(manifest.dependencies.sharp).toBeDefined();
    expect(existsSync(join(appFolder, "packages/core/node_modules/@lintel/builder"))).toBe(true);
    expect(existsSync(join(appFolder, "tmp"))).toBe(true);
  });

  it("passes its own hosting check", () => {
    const report = execFileSync("node", ["lintel-check.js"], { cwd: appFolder, encoding: "utf8" });
    expect(report).toContain("[OK] Image resizing: Pictures can be resized");
    expect(report).toMatch(/Lintel will run here/);
  }, 30_000);

  it("starts with `node app.js` and serves the wizard, the website and the API on one port", async () => {
    lintel = spawn("node", ["app.js"], {
      cwd: appFolder,
      env: { ...process.env, PORT: String(PORT), PUBLIC_URL: ORIGIN, NODE_ENV: "production" },
    });
    lintel.stdout?.on("data", (chunk: Buffer) => (log += chunk.toString()));
    lintel.stderr?.on("data", (chunk: Buffer) => (log += chunk.toString()));
    await waitForReady();
    const startedRss = residentMegabytes(lintel.pid);

    const admin = await fetch(`${ORIGIN}/admin/`);
    expect(admin.status).toBe(200);
    const adminPage = await admin.text();
    expect(adminPage).toContain('name="lintel-admin"');
    const status = await (await fetch(`${ORIGIN}/api/setup/status`)).json();
    expect(status.needsSetup).toBe(true);
    const website = await fetch(`${ORIGIN}/`);
    expect(website.status).toBe(200);
    expect(website.headers.get("content-type")).toContain("text/html");
    const script = adminPage.match(/src="\.\/(assets\/[^"]+\.js)"/)?.[1];
    if (script) expect((await fetch(`${ORIGIN}/admin/${script}`)).status).toBe(200);

    const setupCode = readFileSync(join(appFolder, ".lintel", "setup-code.txt"), "utf8").trim();
    expect(setupCode).toMatch(/^\d{4}-\d{4}$/);
    const busyRss = residentMegabytes(lintel.pid);
    process.stdout.write(
      `\nHosting package memory: ${startedRss} MB after starting, ${busyRss} MB after use\n`,
    );
  }, 120_000);

  it("runs its scheduled jobs for a cron request with the secret it made", async () => {
    const line = execFileSync("node", ["lintel.js", "cron", "--print-line"], {
      cwd: appFolder,
      encoding: "utf8",
      env: { ...process.env, PORT: String(PORT), PUBLIC_URL: ORIGIN },
    });
    expect(line).toContain(`${ORIGIN}/api/system/run-scheduled-jobs`);

    const ran = execFileSync("node", ["lintel.js", "cron"], {
      cwd: appFolder,
      encoding: "utf8",
      env: { ...process.env, PORT: String(PORT), PUBLIC_URL: ORIGIN },
    });
    expect(ran).toContain("scheduled-publishing");
  }, 60_000);

  async function waitForReady() {
    for (let attempt = 0; attempt < 120; attempt++) {
      if (lintel?.exitCode !== null) throw new Error(`Lintel stopped:\n${log}`);
      try {
        if ((await fetch(`${ORIGIN}/ready`)).ok) return;
      } catch {
        // Not listening yet.
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`Lintel didn't become ready:\n${log}`);
  }
});

function residentMegabytes(processId: number | undefined): number {
  // Only Linux has /proc; the figure is only printed, for the hosting guide.
  if (!existsSync(`/proc/${processId}/status`)) return 0;
  const status = readFileSync(`/proc/${processId}/status`, "utf8");
  const kilobytes = Number(/VmRSS:\s+(\d+)/.exec(status)?.[1] ?? 0);
  return Math.round(kilobytes / 1024);
}
