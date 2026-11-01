import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { readlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  listInstalledVersions,
  pointCurrentAt,
  readUpdateHistory,
  versionFolder,
} from "../install-home.js";
import type { ReleaseManifest } from "../install-home.js";
import { type ServerProcess, Supervisor, type SupervisorDependencies } from "./supervisor.js";
import { switchRequestMessage } from "./supervisor-messages.js";

/** A pretend server: it "runs" until stopped, can crash, and can send the supervisor messages. */
class FakeServer implements ServerProcess {
  readonly exited: Promise<number | null>;
  private finish: (code: number | null) => void = () => undefined;
  private listeners: Array<(message: unknown) => void> = [];
  stopped = false;

  constructor(readonly version: string) {
    this.exited = new Promise((resolve) => {
      this.finish = resolve;
    });
  }
  async stop() {
    this.stopped = true;
    this.finish(0);
  }
  crash() {
    this.finish(1);
  }
  onMessage(listener: (message: unknown) => void) {
    this.listeners.push(listener);
  }
  send(message: unknown) {
    for (const listener of this.listeners) listener(message);
  }
}

describe("the supervisor", () => {
  let home: string;
  let servers: FakeServer[];
  let programs: Array<{ version: string; script: string; argumentList: string[] }>;
  let maintenance: string[];
  let readyVersions: Set<string>;
  let failingPrograms: Set<string>;
  let clock: number;

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), "lintel-supervisor-"));
    servers = [];
    programs = [];
    maintenance = [];
    readyVersions = new Set(["1.0.0", "1.1.0"]);
    failingPrograms = new Set();
    clock = Date.parse("2026-11-01T09:00:00Z");
    for (const version of ["1.0.0", "1.1.0"]) {
      await mkdir(versionFolder(home, version), { recursive: true });
      await writeFile(
        join(versionFolder(home, version), "release.json"),
        JSON.stringify({ version }),
      );
    }
    await pointCurrentAt(home, versionFolder(home, "1.0.0"));
  });
  afterEach(() => rm(home, { recursive: true, force: true }));

  function supervisor() {
    const versionOf = (folder: string) => folder.split(/[\\/]/).pop() ?? "";
    const dependencies: SupervisorDependencies = {
      startServer(_folder: string, manifest: ReleaseManifest) {
        const server = new FakeServer(manifest.version);
        servers.push(server);
        return server;
      },
      async runProgram(folder, script, argumentList) {
        programs.push({ version: versionOf(folder), script, argumentList });
        return failingPrograms.has(`${versionOf(folder)} ${argumentList[0] ?? "migrate"}`) ? 1 : 0;
      },
      async openMaintenancePage() {
        maintenance.push("open");
        return { close: async () => void maintenance.push("closed") };
      },
      async isReady() {
        const running = servers.at(-1);
        return running !== undefined && !running.stopped && readyVersions.has(running.version);
      },
      async sleep(milliseconds) {
        clock += milliseconds;
      },
      log: () => undefined,
      now: () => new Date(clock),
    };
    return new Supervisor(
      {
        home,
        fallbackFolder: home,
        fallbackVersion: "0.9.0",
        readyTimeoutMilliseconds: 5_000,
        readyIntervalMilliseconds: 1_000,
      },
      dependencies,
    );
  }

  const currentPointsAt = () => readlinkSync(join(home, "current")).split(/[\\/]/).pop();

  it("starts the version `current` points at", async () => {
    const running = supervisor();
    await running.start();
    expect(running.runningVersion).toBe("1.0.0");
    expect(servers.map((server) => server.version)).toEqual(["1.0.0"]);
  });

  it("switches versions when the server asks: maintenance, migrations, swap, restart, health check", async () => {
    const running = supervisor();
    await running.start();

    const result = await running.switchVersion({
      kind: "update",
      version: "1.1.0",
      backupFile: "/backups/before.zip",
      restoreBackupFirst: false,
    });

    expect(result).toMatchObject({ step: "done", version: "1.1.0", fromVersion: "1.0.0" });
    expect(servers[0]?.stopped).toBe(true);
    expect(servers.map((server) => server.version)).toEqual(["1.0.0", "1.1.0"]);
    expect(programs).toEqual([
      { version: "1.1.0", script: "packages/core/dist/scripts/migrate.js", argumentList: [] },
    ]);
    expect(maintenance).toEqual(["open", "closed"]);
    expect(currentPointsAt()).toBe("1.1.0");
    expect((await readUpdateHistory(home)).map((entry) => entry.step)).toEqual(["done"]);
    const status = JSON.parse(await readFile(join(home, "versions", "update-status.json"), "utf8"));
    expect(status).toMatchObject({ step: "done", backupFilename: "before.zip" });
  });

  it("goes back by itself, restoring the backup, when the new version doesn't start", async () => {
    readyVersions.delete("1.1.0");
    const running = supervisor();
    await running.start();

    const result = await running.switchVersion({
      kind: "update",
      version: "1.1.0",
      backupFile: "/backups/before.zip",
      restoreBackupFirst: false,
    });

    expect(result.step).toBe("failed");
    expect(result.message).toContain("didn't start properly");
    expect(result.message).toContain("Lintel 1.0.0 is running again, with the backup put back");
    expect(currentPointsAt()).toBe("1.0.0");
    expect(servers.map((server) => server.version)).toEqual(["1.0.0", "1.1.0", "1.0.0"]);
    expect(programs.at(-1)).toEqual({
      version: "1.0.0",
      script: "packages/cli/dist/main.js",
      argumentList: ["restore", "/backups/before.zip", "--yes"],
    });
  });

  it("goes back without touching current when the migrations fail", async () => {
    failingPrograms.add("1.1.0 migrate");
    const running = supervisor();
    await running.start();

    const result = await running.switchVersion({
      kind: "update",
      version: "1.1.0",
      backupFile: "/backups/before.zip",
      restoreBackupFirst: false,
    });

    expect(result.step).toBe("failed");
    expect(currentPointsAt()).toBe("1.0.0");
    expect(running.runningVersion).toBe("1.0.0");
    expect(programs.map((program) => program.argumentList[0] ?? "migrate")).toEqual([
      "migrate",
      "restore",
    ]);
  });

  it("rolls back on request, putting the earlier backup back first", async () => {
    await pointCurrentAt(home, versionFolder(home, "1.1.0"));
    const running = supervisor();
    await running.start();

    const result = await running.switchVersion({
      kind: "rollback",
      version: "1.0.0",
      backupFile: "/backups/before.zip",
      restoreBackupFirst: true,
    });

    expect(result).toMatchObject({ step: "done", kind: "rollback", version: "1.0.0" });
    expect(
      programs.map((program) => [program.version, program.argumentList[0] ?? "migrate"]),
    ).toEqual([
      ["1.0.0", "restore"],
      ["1.0.0", "migrate"],
    ]);
    expect(currentPointsAt()).toBe("1.0.0");
  });

  it("listens to the server's request over IPC, and ignores anything else", async () => {
    const running = supervisor();
    await running.start();
    servers[0]?.send({ type: "something else" });
    servers[0]?.send(
      switchRequestMessage({
        kind: "update",
        version: "1.1.0",
        backupFile: null,
        restoreBackupFirst: false,
      }),
    );
    await expect.poll(() => running.runningVersion).toBe("1.1.0");
    await expect.poll(() => running.isSwitching).toBe(false);
  });

  it("starts the server again when it stops by itself", async () => {
    const running = supervisor();
    await running.start();
    servers[0]?.crash();
    await expect.poll(() => servers.length).toBe(2);
    expect(running.runningVersion).toBe("1.0.0");
  });

  it("lists the versions kept on disk, saying which runs and which backup came before leaving it", async () => {
    const running = supervisor();
    await running.start();
    await running.switchVersion({
      kind: "update",
      version: "1.1.0",
      backupFile: "/backups/before.zip",
      restoreBackupFirst: false,
    });

    const versions = await listInstalledVersions(home, join(home, "current"));
    expect(
      versions.map(({ version, current, backupBeforeLeaving }) => ({
        version,
        current,
        backupBeforeLeaving,
      })),
    ).toEqual([
      { version: "1.1.0", current: true, backupBeforeLeaving: null },
      { version: "1.0.0", current: false, backupBeforeLeaving: "before.zip" },
    ]);
  });
});
