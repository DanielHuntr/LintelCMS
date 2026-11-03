import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  listInstalledVersions,
  pointCurrentAt,
  readUpdateHistory,
  readUpdateStatus,
  versionFolder,
} from "../install-home.js";
import type { ReleaseManifest } from "../install-home.js";
import { FolderDatabaseCopies } from "./database-copies.js";
import { type ServerProcess, Supervisor, type SupervisorDependencies } from "./supervisor.js";
import { switchRequestMessage } from "./supervisor-messages.js";
import { readSwitchJournal, type SwitchJournal, writeSwitchJournal } from "./switch-journal.js";

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

/** Each release's migrations: 1.1.0 adds one that 1.0.0 and 1.0.1 don't know. */
const MIGRATIONS: Record<string, string[]> = {
  "1.0.0": ["0000_initial_schema"],
  "1.0.1": ["0000_initial_schema"],
  "1.1.0": ["0000_initial_schema", "0001_add_refunds"],
};

describe("the supervisor", () => {
  let home: string;
  let dataFolder: string;
  let servers: FakeServer[];
  let programs: Array<{ version: string; script: string; argumentList: string[] }>;
  let maintenance: string[];
  let readyVersions: Set<string>;
  let failingPrograms: Set<string>;
  let clock: number;

  /** The pretend built-in database: one file saying whose tables it holds, and what's in it. */
  const writeTables = (contents: string) => writeFile(join(dataFolder, "tables"), contents);
  const readTables = () => readFile(join(dataFolder, "tables"), "utf8");

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), "lintel-supervisor-"));
    dataFolder = join(home, ".lintel", "data");
    servers = [];
    programs = [];
    maintenance = [];
    readyVersions = new Set(Object.keys(MIGRATIONS));
    failingPrograms = new Set();
    clock = Date.parse("2026-11-01T09:00:00Z");
    for (const [version, tags] of Object.entries(MIGRATIONS)) {
      const folder = versionFolder(home, version);
      await mkdir(join(folder, "packages/core/migrations/meta"), { recursive: true });
      await writeFile(join(folder, "release.json"), JSON.stringify({ version }));
      await writeFile(
        join(folder, "packages/core/migrations/meta/_journal.json"),
        JSON.stringify({ entries: tags.map((tag, idx) => ({ idx, tag })) }),
      );
    }
    await pointCurrentAt(home, versionFolder(home, "1.0.0"));
    await mkdir(dataFolder, { recursive: true });
    await writeTables("tables of 1.0.0");
  });
  afterEach(() => rm(home, { recursive: true, force: true }));

  function supervisor(options: { postgres?: boolean } = {}) {
    const versionOf = (folder: string) => folder.split(/[\\/]/).pop() ?? "";
    const dependencies: SupervisorDependencies = {
      startServer(_folder: string, manifest: ReleaseManifest) {
        const server = new FakeServer(manifest.version);
        servers.push(server);
        return server;
      },
      async runProgram(folder, script, argumentList) {
        const version = versionOf(folder);
        programs.push({ version, script, argumentList });
        if (failingPrograms.has(`${version} ${argumentList[0] ?? "migrate"}`)) {
          // Migrations that fail part-way have still changed something.
          await writeTables(`half-migrated to ${version}`);
          return 1;
        }
        if (argumentList.length === 0) {
          const before = await readTables();
          const tables = MIGRATIONS[version]?.length === 2 ? "1.1.0" : "1.0.0";
          await writeTables(before.replace(/tables of [\d.]+/, `tables of ${tables}`));
        }
        return 0;
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
      databaseCopies: options.postgres
        ? null
        : new FolderDatabaseCopies(home, dataFolder, () => new Date(clock)),
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

  const currentPointsAt = () => realpathSync(join(home, "current")).split(/[\\/]/).pop();
  const update = (version = "1.1.0") => ({
    kind: "update" as const,
    version,
    backupFile: "/backups/before.zip",
    restoreBackupFirst: false,
    databaseCopy: null,
  });

  it("starts the version `current` points at", async () => {
    const running = supervisor();
    await running.start();
    expect(running.runningVersion).toBe("1.0.0");
    expect(servers.map((server) => server.version)).toEqual(["1.0.0"]);
  });

  it("switches versions when the server asks: maintenance, copy, migrations, swap, restart, health check", async () => {
    const running = supervisor();
    await running.start();

    const result = await running.switchVersion(update());

    expect(result).toMatchObject({ step: "done", version: "1.1.0", fromVersion: "1.0.0" });
    expect(result.databaseCopy).toMatch(/1\.0\.0-to-1\.1\.0$/);
    expect(servers[0]?.stopped).toBe(true);
    expect(servers.map((server) => server.version)).toEqual(["1.0.0", "1.1.0"]);
    expect(programs).toEqual([
      { version: "1.1.0", script: "packages/core/dist/scripts/migrate.js", argumentList: [] },
    ]);
    expect(maintenance).toEqual(["open", "closed"]);
    expect(currentPointsAt()).toBe("1.1.0");
    expect(await readTables()).toBe("tables of 1.1.0");
    expect((await readUpdateHistory(home)).map((entry) => entry.step)).toEqual(["done"]);
    const status = JSON.parse(await readFile(join(home, "versions", "update-status.json"), "utf8"));
    expect(status).toMatchObject({ step: "done", backupFilename: "before.zip" });
    expect(await readSwitchJournal(home)).toBeNull();
  });

  it("switches more than once (LINTEL-FUNC-016: the second switch failed on Windows)", async () => {
    const running = supervisor();
    await running.start();
    expect((await running.switchVersion(update("1.0.1"))).step).toBe("done");
    expect((await running.switchVersion(update("1.1.0"))).step).toBe("done");
    expect(currentPointsAt()).toBe("1.1.0");
  });

  // LINTEL-DATA-013: the copy is taken once the site is paused, so nothing made while the
  // update downloaded (an order, say) is lost when it is put back.
  it("goes back by itself, with the database as it was at the switch, when the new version doesn't start", async () => {
    readyVersions.delete("1.1.0");
    const running = supervisor();
    await running.start();
    await writeTables("tables of 1.0.0, with an order placed during the download");

    const result = await running.switchVersion(update());

    expect(result.step).toBe("failed");
    expect(result.message).toContain("didn't start properly");
    expect(result.message).toContain(
      "Lintel 1.0.0 is running again, with the database put back as it was.",
    );
    expect(currentPointsAt()).toBe("1.0.0");
    expect(servers.map((server) => server.version)).toEqual(["1.0.0", "1.1.0", "1.0.0"]);
    expect(await readTables()).toBe("tables of 1.0.0, with an order placed during the download");
    // The backup made before the switch isn't what goes back.
    expect(programs.map((program) => program.argumentList[0] ?? "migrate")).toEqual(["migrate"]);
  });

  it("goes back without touching current when the migrations fail, undoing what they did", async () => {
    failingPrograms.add("1.1.0 migrate");
    const running = supervisor();
    await running.start();

    const result = await running.switchVersion(update());

    expect(result.step).toBe("failed");
    expect(currentPointsAt()).toBe("1.0.0");
    expect(running.runningVersion).toBe("1.0.0");
    expect(await readTables()).toBe("tables of 1.0.0");
  });

  // LINTEL-DATA-011: a roll back brings back the older tables, not just the rows.
  it("rolls back on request, putting the database back exactly as it was before the update", async () => {
    const running = supervisor();
    await running.start();
    const updated = await running.switchVersion(update());
    await writeTables("tables of 1.1.0, with a page added after the update");

    const result = await running.switchVersion({
      kind: "rollback",
      version: "1.0.0",
      backupFile: "/backups/before.zip",
      restoreBackupFirst: true,
      databaseCopy: updated.databaseCopy,
    });

    expect(result).toMatchObject({ step: "done", kind: "rollback", version: "1.0.0" });
    expect(await readTables()).toBe("tables of 1.0.0");
    expect(currentPointsAt()).toBe("1.0.0");
    // The copy went back, not the backup's rows.
    expect(programs.some((program) => program.argumentList[0] === "restore")).toBe(false);
  });

  it("refuses to roll back across database changes without putting the copy back", async () => {
    const running = supervisor();
    await running.start();
    await running.switchVersion(update());

    const result = await running.switchVersion({
      kind: "rollback",
      version: "1.0.0",
      backupFile: null,
      restoreBackupFirst: false,
      databaseCopy: null,
    });

    expect(result.step).toBe("failed");
    expect(result.message).toContain("Lintel 1.1.0 changed the database");
    expect(result.message).toContain("Nothing was changed");
    expect(running.runningVersion).toBe("1.1.0");
    expect(servers.at(-1)?.stopped).toBe(false);
    expect(currentPointsAt()).toBe("1.1.0");
    expect(await readTables()).toBe("tables of 1.1.0");
  });

  it("rolls back between versions with the same tables without touching the data", async () => {
    const running = supervisor();
    await running.start();
    await running.switchVersion(update("1.0.1"));
    await writeTables("tables of 1.0.0, with new content");

    const result = await running.switchVersion({
      kind: "rollback",
      version: "1.0.0",
      backupFile: null,
      restoreBackupFirst: false,
      databaseCopy: null,
    });

    expect(result.step).toBe("done");
    expect(await readTables()).toBe("tables of 1.0.0, with new content");
  });

  it("on Postgres, refuses an update that changes the database before stopping anything", async () => {
    const running = supervisor({ postgres: true });
    await running.start();

    const refused = await running.switchVersion(update());
    expect(refused.step).toBe("failed");
    expect(refused.message).toContain("on a Postgres server");
    expect(servers).toHaveLength(1);
    expect(servers[0]?.stopped).toBe(false);
    expect(maintenance).toEqual([]);

    // One that doesn't change it goes ahead.
    expect((await running.switchVersion(update("1.0.1"))).step).toBe("done");
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

  it("lists the versions kept on disk, with the backup and the database copy made before leaving", async () => {
    const running = supervisor();
    await running.start();
    const updated = await running.switchVersion(update());

    const versions = await listInstalledVersions(home, join(home, "current"));
    expect(
      versions.map((version) => ({
        version: version.version,
        current: version.current,
        backupBeforeLeaving: version.backupBeforeLeaving,
        databaseCopyBeforeLeaving: version.databaseCopyBeforeLeaving,
        databaseDiffers: version.databaseDiffers,
      })),
    ).toEqual([
      {
        version: "1.1.0",
        current: true,
        backupBeforeLeaving: null,
        databaseCopyBeforeLeaving: null,
        databaseDiffers: false,
      },
      {
        version: "1.0.1",
        current: false,
        backupBeforeLeaving: null,
        databaseCopyBeforeLeaving: null,
        databaseDiffers: true,
      },
      {
        version: "1.0.0",
        current: false,
        backupBeforeLeaving: "before.zip",
        databaseCopyBeforeLeaving: updated.databaseCopy,
        databaseDiffers: true,
      },
    ]);
  });

  describe("after stopping part-way through a switch (LINTEL-FUNC-027)", () => {
    /** Updates to 1.1.0, then leaves a journal as if a switch had stopped at `phase`. */
    async function dieDuring(
      phase: SwitchJournal["phase"],
      kind: "update" | "rollback" = "update",
    ) {
      const first = supervisor();
      await first.start();
      const updated = await first.switchVersion(update());
      const [from, to] = kind === "update" ? ["1.0.0", "1.1.0"] : ["1.1.0", "1.0.0"];
      await writeSwitchJournal(home, {
        kind,
        fromVersion: from,
        fromFolder: versionFolder(home, from),
        toVersion: to,
        toFolder: versionFolder(home, to),
        backupFile: null,
        restoreBackupFirst: kind === "rollback",
        databaseCopy: updated.databaseCopy,
        phase,
        startedAt: new Date(clock).toISOString(),
      });
      await first.stop();
      servers = [];
    }

    it("puts the database copy back and starts the old version when migrations had begun", async () => {
      await dieDuring("switched");
      await writeTables("half-migrated to 1.1.0");

      const restarted = supervisor();
      await restarted.start();

      expect(restarted.runningVersion).toBe("1.0.0");
      expect(currentPointsAt()).toBe("1.0.0");
      expect(await readTables()).toBe("tables of 1.0.0");
      expect(await readSwitchJournal(home)).toBeNull();
      const status = await readUpdateStatus(home);
      expect(status).toMatchObject({ step: "failed", version: "1.1.0" });
      expect(status?.message).toContain("stopped part-way through updating to 1.1.0");
      expect((await readUpdateHistory(home)).at(-1)?.step).toBe("failed");
    });

    it("leaves the database alone when it stopped before migrating", async () => {
      await dieDuring("copied");
      await pointCurrentAt(home, versionFolder(home, "1.0.0"));
      await writeTables("tables of 1.0.0, untouched");

      const restarted = supervisor();
      await restarted.start();

      expect(restarted.runningVersion).toBe("1.0.0");
      expect(await readTables()).toBe("tables of 1.0.0, untouched");
    });

    it("keeps the new version when it had already answered", async () => {
      await dieDuring("healthy");

      const restarted = supervisor();
      await restarted.start();

      expect(restarted.runningVersion).toBe("1.1.0");
      expect(await readTables()).toBe("tables of 1.1.0");
      expect(await readUpdateStatus(home)).toMatchObject({ step: "done", version: "1.1.0" });
    });

    it("does a roll back again from the start", async () => {
      await dieDuring("migrating", "rollback");

      const restarted = supervisor();
      await restarted.start();

      expect(restarted.runningVersion).toBe("1.0.0");
      expect(currentPointsAt()).toBe("1.0.0");
      expect(await readTables()).toBe("tables of 1.0.0");
      expect(await readUpdateStatus(home)).toMatchObject({ step: "done", kind: "rollback" });
      expect(await readSwitchJournal(home)).toBeNull();
    });
  });
});
