import { join } from "node:path";
import {
  currentTarget,
  databaseCopyExists,
  databaseDiffers,
  pointCurrentAt,
  readReleaseManifest,
  recordUpdateHistory,
  type ReleaseManifest,
  versionFolder,
  writeUpdateStatus,
} from "../install-home.js";
import type { UpdateProgress, UpdateStepId } from "../updates.schema.js";
import type { DatabaseCopies } from "./database-copies.js";
import { readSupervisorRequest, type SwitchRequest } from "./supervisor-messages.js";
import {
  clearSwitchJournal,
  databaseMayHaveChanged,
  readSwitchJournal,
  type SwitchJournal,
  type SwitchPhase,
  writeSwitchJournal,
} from "./switch-journal.js";

/**
 * The small program `lintel start` runs. It starts Lintel's server as a child process and
 * stays out of the way, restarting it if it stops by itself. When the server asks it to
 * switch versions (after it has downloaded, checked and unpacked the new release), it:
 *
 *   1. stops the server and answers the site's address with a maintenance page itself;
 *   2. copies the built-in database while nothing can write to it (database-copies.ts);
 *   3. brings the database up to date with the new version's migrations;
 *   4. points `current` at the new version, starts it and waits for /ready;
 *   5. if anything fails, stops the new version, puts the database copy back if migrations
 *      ran, points `current` back and starts the version that was running.
 *
 * A switch that would leave a version running on tables it doesn't know is refused before
 * anything stops: an update that changes a Postgres database (which can't be copied
 * here), and a roll back across database changes without putting the copy back.
 *
 * Every step is written to versions/update-status.json, which the maintenance page and the
 * admin read, and the result to versions/update-history.json. Before each step the switch
 * journal says how far it got, so a supervisor that stopped part-way finishes or reverses
 * the switch when it starts again (switch-journal.ts). Processes, the port and time come
 * in through `SupervisorDependencies`, so tests run it with a pretend server.
 */

export interface ServerProcess {
  /** Resolves with the exit code when the process ends, however it ends. */
  readonly exited: Promise<number | null>;
  /** Asks it to stop (SIGTERM), and kills it if it hasn't after `timeoutMilliseconds`. */
  stop(timeoutMilliseconds: number): Promise<void>;
  onMessage(listener: (message: unknown) => void): void;
}

export interface MaintenancePage {
  close(): Promise<void>;
}

export interface SupervisorDependencies {
  startServer(folder: string, manifest: ReleaseManifest): ServerProcess;
  /** Runs one of a release's programs (migrations, a restore) and resolves with its exit code. */
  runProgram(folder: string, script: string, argumentList: string[]): Promise<number>;
  /** Answers the site's address with the maintenance page while no server does. */
  openMaintenancePage(): Promise<MaintenancePage>;
  isReady(): Promise<boolean>;
  sleep(milliseconds: number): Promise<void>;
  log(message: string): void;
  now(): Date;
  /** Copies of the built-in database; null when the database can't be copied (Postgres). */
  databaseCopies: DatabaseCopies | null;
}

interface RunningRelease {
  folder: string;
  manifest: ReleaseManifest;
}

export interface SupervisorOptions {
  home: string;
  /** The release to run before `current` exists: the folder `lintel start` itself is in. */
  fallbackFolder: string;
  fallbackVersion: string;
  /** How long a new version has to answer /ready. */
  readyTimeoutMilliseconds?: number;
  readyIntervalMilliseconds?: number;
  stopTimeoutMilliseconds?: number;
}

/** Restarts after a crash, but stops trying if it keeps crashing straight away. */
const MAX_QUICK_CRASHES = 5;
const QUICK_CRASH_MILLISECONDS = 30_000;

export class Supervisor {
  private server: ServerProcess | null = null;
  private running: RunningRelease | null = null;
  private switching = false;
  private stopping = false;
  private quickCrashes = 0;
  private readonly readyTimeout: number;
  private readonly readyInterval: number;
  private readonly stopTimeout: number;

  constructor(
    private readonly options: SupervisorOptions,
    private readonly dependencies: SupervisorDependencies,
  ) {
    this.readyTimeout = options.readyTimeoutMilliseconds ?? 90_000;
    this.readyInterval = options.readyIntervalMilliseconds ?? 1_000;
    this.stopTimeout = options.stopTimeoutMilliseconds ?? 15_000;
  }

  /** The version that runs now. */
  get runningVersion(): string | null {
    return this.running?.manifest.version ?? null;
  }

  get isSwitching(): boolean {
    return this.switching;
  }

  async start(): Promise<void> {
    const journal = await readSwitchJournal(this.options.home);
    if (journal) {
      await this.recover(journal);
      return;
    }
    const folder = await currentTarget(this.options.home, this.options.fallbackFolder);
    const manifest = await readReleaseManifest(folder, this.options.fallbackVersion);
    this.launch(folder, manifest);
  }

  /** Stops the server for good, as when the supervisor itself is told to stop. */
  async stop(): Promise<void> {
    this.stopping = true;
    await this.server?.stop(this.stopTimeout);
    this.server = null;
  }

  /** Switches to another unpacked version: an update or a roll back. */
  async switchVersion(request: SwitchRequest): Promise<UpdateProgress> {
    if (this.switching || !this.running) {
      throw new Error("An update is already under way");
    }
    this.switching = true;
    try {
      return await this.performSwitch(request, this.running);
    } finally {
      this.switching = false;
    }
  }

  private async performSwitch(
    request: SwitchRequest,
    previous: RunningRelease,
  ): Promise<UpdateProgress> {
    const home = this.options.home;
    const folder = versionFolder(home, request.version);
    const reporter = this.reporter(request, previous.manifest.version);
    const report = reporter.report;
    const restoringCopy =
      request.kind === "rollback" && request.restoreBackupFirst && request.databaseCopy
        ? request.databaseCopy
        : null;
    reporter.databaseCopy = restoringCopy;

    let manifest: ReleaseManifest;
    try {
      manifest = await readReleaseManifest(folder);
      if (manifest.version !== request.version) {
        throw new Error(`versions/${request.version} holds Lintel ${manifest.version}`);
      }
      await this.checkSwitchIsSafe(request, previous, folder, restoringCopy);
    } catch (error) {
      // Nothing has been stopped or changed: the running version carries on.
      const failed = await report("failed", `${reasonOf(error)}.`, true);
      await recordUpdateHistory(home, failed);
      return failed;
    }

    const journal: SwitchJournal = {
      kind: request.kind,
      fromVersion: previous.manifest.version,
      fromFolder: previous.folder,
      toVersion: request.version,
      toFolder: folder,
      backupFile: request.backupFile,
      restoreBackupFirst: request.restoreBackupFirst,
      databaseCopy: restoringCopy,
      phase: "started",
      startedAt: reporter.startedAt,
    };
    const reachPhase = (phase: SwitchPhase) =>
      writeSwitchJournal(home, { ...journal, phase, databaseCopy: reporter.databaseCopy });

    let maintenance: MaintenancePage | null = null;
    let phase: SwitchPhase = "started";
    try {
      await reachPhase(phase);
      await report("maintenance", "Showing the maintenance page while Lintel restarts.");
      await this.stopServer();
      maintenance = await this.dependencies.openMaintenancePage();

      const copies = this.dependencies.databaseCopies;
      if (request.kind === "update" && copies) {
        await report("backing-up", "Copying the database while the site is paused.");
        reporter.databaseCopy = await copies.take({
          fromVersion: previous.manifest.version,
          toVersion: manifest.version,
        });
        phase = "copied";
        await reachPhase(phase);
      }

      if (request.kind === "rollback" && request.restoreBackupFirst) {
        await report("migrating", "Putting the database back as it was before the update.");
        await this.putDatabaseBack(folder, manifest, request.backupFile, restoringCopy);
      }

      phase = "migrating";
      await reachPhase(phase);
      await report("migrating", "Bringing the database up to date.");
      const migrated = await this.dependencies.runProgram(folder, manifest.migrate, []);
      if (migrated !== 0) {
        throw new Error("The new version couldn't bring the database up to date");
      }

      phase = "switched";
      await reachPhase(phase);
      await report("switching", `Switching to Lintel ${manifest.version}.`);
      await pointCurrentAt(home, folder);

      await report("restarting", `Starting Lintel ${manifest.version}.`);
      await maintenance.close();
      maintenance = null;
      this.launch(folder, manifest);

      await report("health-check", "Checking that the site answers.");
      if (!(await this.waitUntilReady())) {
        throw new Error(`Lintel ${manifest.version} didn't start properly`);
      }
      phase = "healthy";
      await reachPhase(phase);

      const done = await report(
        "done",
        request.kind === "update"
          ? `Updated to Lintel ${manifest.version}.`
          : `Rolled back to Lintel ${manifest.version}.`,
        true,
      );
      await recordUpdateHistory(home, done);
      await clearSwitchJournal(home);
      return done;
    } catch (error) {
      const reason = reasonOf(error);
      await report("rolling-back", `${reason}. Going back to Lintel ${previous.manifest.version}.`);
      const restored = await this.rollBack(
        previous,
        request,
        phase,
        reporter.databaseCopy,
        maintenance,
      );
      const failed = await report(
        "failed",
        `${reason}. Lintel ${previous.manifest.version} is running again` +
          (restored ? ", with the database put back as it was." : "."),
        true,
      );
      await recordUpdateHistory(home, failed);
      await clearSwitchJournal(home);
      return failed;
    }
  }

  /**
   * Refuses, before anything stops, a switch that would leave a version running on tables
   * it doesn't know.
   */
  private async checkSwitchIsSafe(
    request: SwitchRequest,
    previous: RunningRelease,
    folder: string,
    restoringCopy: string | null,
  ): Promise<void> {
    if (request.kind === "update") {
      if (!this.dependencies.databaseCopies && (await databaseDiffers(folder, previous.folder))) {
        throw new Error(
          `Lintel ${request.version} changes the database, and on a Postgres server Lintel ` +
            "can't keep a copy to go back to if the update fails. Nothing was changed. " +
            "Make a backup with your database provider, then update by hand (see “Updating Lintel”)",
        );
      }
      return;
    }
    if (!(await databaseDiffers(previous.folder, folder))) {
      return;
    }
    const copyIsThere =
      restoringCopy !== null &&
      this.dependencies.databaseCopies !== null &&
      databaseCopyExists(this.options.home, restoringCopy);
    if (!copyIsThere) {
      throw new Error(
        `Lintel ${previous.manifest.version} changed the database, so Lintel ${request.version} ` +
          "can only run again with the copy of the database made when it was left, and " +
          (restoringCopy ? "that copy isn't there any more" : "it wasn't asked for") +
          ". Nothing was changed",
      );
    }
  }

  /** Before a roll back: the database copy if there is one, otherwise the backup. */
  private async putDatabaseBack(
    folder: string,
    manifest: ReleaseManifest,
    backupFile: string | null,
    databaseCopy: string | null,
  ): Promise<void> {
    const copies = this.dependencies.databaseCopies;
    if (databaseCopy && copies) {
      await copies.restore(databaseCopy);
    } else if (backupFile) {
      await this.restoreBackup(folder, manifest, backupFile);
    }
  }

  /**
   * After a failed switch the version that was running starts again. A failed update puts
   * the database copy back if the new version may have changed the database; a failed roll
   * back leaves the data alone. Resolves true if the copy was put back.
   */
  private async rollBack(
    previous: RunningRelease,
    request: SwitchRequest,
    phase: SwitchPhase,
    databaseCopy: string | null,
    openMaintenance: MaintenancePage | null,
  ): Promise<boolean> {
    let maintenance = openMaintenance;
    let restored = false;
    try {
      await this.stopServer();
      maintenance ??= await this.dependencies.openMaintenancePage();
      const copies = this.dependencies.databaseCopies;
      if (request.kind === "update" && databaseMayHaveChanged(phase) && databaseCopy && copies) {
        await copies.restore(databaseCopy);
        restored = true;
      }
      if (previous.folder !== (await currentTarget(this.options.home, previous.folder))) {
        await pointCurrentAt(this.options.home, previous.folder);
      }
    } catch (error) {
      this.dependencies.log(`Going back hit a problem too: ${reasonOf(error)}`);
    } finally {
      await maintenance?.close();
      this.launch(previous.folder, previous.manifest);
    }
    return restored;
  }

  /**
   * Starting with a switch journal left behind: the last supervisor stopped part-way through
   * a switch. Finishes it or reverses it (see switch-journal.ts), then starts Lintel.
   */
  private async recover(journal: SwitchJournal): Promise<void> {
    const home = this.options.home;
    const from: RunningRelease = {
      folder: journal.fromFolder,
      manifest: await readReleaseManifest(journal.fromFolder, journal.fromVersion),
    };
    const request: SwitchRequest = {
      kind: journal.kind,
      version: journal.toVersion,
      backupFile: journal.backupFile,
      restoreBackupFirst: journal.restoreBackupFirst,
      databaseCopy: journal.databaseCopy,
    };
    this.dependencies.log(
      `Lintel stopped part-way through switching from ${journal.fromVersion} to ` +
        `${journal.toVersion}; finishing that first.`,
    );
    this.switching = true;
    try {
      if (journal.phase === "healthy") {
        // The new version had already answered: keep it.
        const manifest = await readReleaseManifest(journal.toFolder);
        if (journal.toFolder !== (await currentTarget(home, journal.fromFolder))) {
          await pointCurrentAt(home, journal.toFolder);
        }
        this.launch(journal.toFolder, manifest);
        const reporter = this.reporter(request, journal.fromVersion, journal.startedAt);
        reporter.databaseCopy = journal.databaseCopy;
        const done = await reporter.report(
          "done",
          journal.kind === "update"
            ? `Updated to Lintel ${journal.toVersion}.`
            : `Rolled back to Lintel ${journal.toVersion}.`,
          true,
        );
        await recordUpdateHistory(home, done);
        await clearSwitchJournal(home);
        return;
      }
      if (journal.kind === "rollback") {
        // Each step of a roll back can be repeated, so it is done again from the start.
        this.running = from;
        await this.performSwitch(request, from);
        return;
      }
      const reporter = this.reporter(request, journal.fromVersion, journal.startedAt);
      reporter.databaseCopy = journal.databaseCopy;
      const restored = await this.rollBack(
        from,
        request,
        journal.phase,
        journal.databaseCopy,
        null,
      );
      const failed = await reporter.report(
        "failed",
        `Lintel stopped part-way through updating to ${journal.toVersion}. ` +
          `Lintel ${journal.fromVersion} is running again` +
          (restored ? ", with the database put back as it was." : "."),
        true,
      );
      await recordUpdateHistory(home, failed);
      await clearSwitchJournal(home);
    } finally {
      this.switching = false;
    }
  }

  /** Writes each step to the status file the maintenance page and the admin read. */
  private reporter(request: SwitchRequest, fromVersion: string, startedAt?: string) {
    const reporter = {
      startedAt: startedAt ?? this.dependencies.now().toISOString(),
      databaseCopy: null as string | null,
      report: async (step: UpdateStepId, message: string, finished = false) => {
        const progress: UpdateProgress = {
          version: request.version,
          fromVersion,
          kind: request.kind,
          step,
          message,
          fraction: null,
          startedAt: reporter.startedAt,
          finishedAt: finished ? this.dependencies.now().toISOString() : null,
          backupFilename: request.backupFile ? fileName(request.backupFile) : null,
          databaseCopy: reporter.databaseCopy,
        };
        this.dependencies.log(message);
        await writeUpdateStatus(this.options.home, progress);
        return progress;
      },
    };
    return reporter;
  }

  private async restoreBackup(folder: string, manifest: ReleaseManifest, backupFile: string) {
    const restored = await this.dependencies.runProgram(folder, manifest.cli, [
      "restore",
      backupFile,
      "--yes",
    ]);
    if (restored !== 0) {
      throw new Error("The backup couldn't be put back");
    }
  }

  private launch(folder: string, manifest: ReleaseManifest): void {
    const server = this.dependencies.startServer(folder, manifest);
    const launchedAt = this.dependencies.now().getTime();
    this.server = server;
    this.running = { folder, manifest };
    server.onMessage((message) => void this.handleMessage(message));
    void server.exited.then((code) => {
      if (this.server !== server || this.stopping || this.switching) {
        return;
      }
      this.server = null;
      const quick = this.dependencies.now().getTime() - launchedAt < QUICK_CRASH_MILLISECONDS;
      this.quickCrashes = quick ? this.quickCrashes + 1 : 0;
      if (this.quickCrashes >= MAX_QUICK_CRASHES) {
        this.dependencies.log(
          `Lintel stopped ${MAX_QUICK_CRASHES} times in a row just after starting; ` +
            "not starting it again. Check the log above for the reason.",
        );
        return;
      }
      this.dependencies.log(`Lintel stopped (exit code ${code ?? "none"}); starting it again.`);
      void this.dependencies.sleep(1_000 * this.quickCrashes).then(() => {
        if (!this.stopping && !this.switching && this.server === null) {
          this.launch(folder, manifest);
        }
      });
    });
  }

  private async stopServer(): Promise<void> {
    const server = this.server;
    this.server = null;
    await server?.stop(this.stopTimeout);
  }

  private async waitUntilReady(): Promise<boolean> {
    const deadline = this.dependencies.now().getTime() + this.readyTimeout;
    while (this.dependencies.now().getTime() < deadline) {
      if (await this.dependencies.isReady()) {
        return true;
      }
      await this.dependencies.sleep(this.readyInterval);
    }
    return false;
  }

  private async handleMessage(message: unknown): Promise<void> {
    const request = readSupervisorRequest(message);
    if (!request) {
      return;
    }
    try {
      await this.switchVersion(request);
    } catch (error) {
      this.dependencies.log(error instanceof Error ? error.message : String(error));
    }
  }
}

function reasonOf(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).replace(/\.$/, "");
}

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/** Where a release's program is, for `runProgram` and `startServer`. */
export function programPath(folder: string, script: string): string {
  return join(folder, script);
}
