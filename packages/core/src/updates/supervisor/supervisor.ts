import { join } from "node:path";
import {
  currentTarget,
  pointCurrentAt,
  readReleaseManifest,
  recordUpdateHistory,
  type ReleaseManifest,
  versionFolder,
  writeUpdateStatus,
} from "../install-home.js";
import type { UpdateProgress, UpdateStepId } from "../updates.schema.js";
import { readSupervisorRequest, type SwitchRequest } from "./supervisor-messages.js";

/**
 * The small program `lintel start` runs. It starts Lintel's server as a child process and
 * stays out of the way, restarting it if it stops by itself. When the server asks it to
 * switch versions (after it has made a backup and downloaded, checked and unpacked the new
 * release), it:
 *
 *   1. stops the server and answers the site's address with a maintenance page itself;
 *   2. brings the database up to date with the new version's migrations;
 *   3. points `current` at the new version, starts it and waits for /ready;
 *   4. if anything fails, stops the new version, puts the database back from the backup
 *      if migrations ran, points `current` back and starts the version that was running.
 *
 * Every step is written to versions/update-status.json, which the maintenance page and the
 * admin read, and the result to versions/update-history.json. Processes, the port and time
 * come in through `SupervisorDependencies`, so tests run it with a pretend server.
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
  private running: { folder: string; manifest: ReleaseManifest } | null = null;
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
    const previous = this.running;
    const startedAt = this.dependencies.now().toISOString();
    const report = async (step: UpdateStepId, message: string, finished = false) => {
      const progress: UpdateProgress = {
        version: request.version,
        fromVersion: previous.manifest.version,
        kind: request.kind,
        step,
        message,
        fraction: null,
        startedAt,
        finishedAt: finished ? this.dependencies.now().toISOString() : null,
        backupFilename: request.backupFile ? fileName(request.backupFile) : null,
      };
      this.dependencies.log(message);
      await writeUpdateStatus(this.options.home, progress);
      return progress;
    };

    let maintenance: MaintenancePage | null = null;
    let migrationsStarted = false;
    try {
      const folder = versionFolder(this.options.home, request.version);
      const manifest = await readReleaseManifest(folder);
      if (manifest.version !== request.version) {
        throw new Error(`versions/${request.version} holds Lintel ${manifest.version}`);
      }

      await report("maintenance", "Showing the maintenance page while Lintel restarts.");
      await this.stopServer();
      maintenance = await this.dependencies.openMaintenancePage();

      if (request.restoreBackupFirst && request.backupFile) {
        await report("migrating", "Putting back the backup made before the update.");
        await this.restoreBackup(folder, manifest, request.backupFile);
      }
      await report("migrating", "Bringing the database up to date.");
      migrationsStarted = true;
      const migrated = await this.dependencies.runProgram(folder, manifest.migrate, []);
      if (migrated !== 0) {
        throw new Error("The new version couldn't bring the database up to date");
      }

      await report("switching", `Switching to Lintel ${manifest.version}.`);
      await pointCurrentAt(this.options.home, folder);

      await report("restarting", `Starting Lintel ${manifest.version}.`);
      await maintenance.close();
      maintenance = null;
      this.launch(folder, manifest);

      await report("health-check", "Checking that the site answers.");
      if (!(await this.waitUntilReady())) {
        throw new Error(`Lintel ${manifest.version} didn't start properly`);
      }

      const done = await report(
        "done",
        request.kind === "update"
          ? `Updated to Lintel ${manifest.version}.`
          : `Rolled back to Lintel ${manifest.version}.`,
        true,
      );
      await recordUpdateHistory(this.options.home, done);
      return done;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await report("rolling-back", `${reason}. Going back to Lintel ${previous.manifest.version}.`);
      await this.rollBack(previous, request, migrationsStarted, maintenance);
      const failed = await report(
        "failed",
        `${reason}. Lintel ${previous.manifest.version} is running again` +
          (this.shouldRestoreAfterFailure(request, migrationsStarted) && request.backupFile
            ? ", with the backup put back."
            : "."),
        true,
      );
      await recordUpdateHistory(this.options.home, failed);
      return failed;
    } finally {
      this.switching = false;
    }
  }

  private async rollBack(
    previous: { folder: string; manifest: ReleaseManifest },
    request: SwitchRequest,
    migrationsStarted: boolean,
    openMaintenance: MaintenancePage | null,
  ): Promise<void> {
    let maintenance = openMaintenance;
    try {
      await this.stopServer();
      maintenance ??= await this.dependencies.openMaintenancePage();
      if (this.shouldRestoreAfterFailure(request, migrationsStarted) && request.backupFile) {
        await this.restoreBackup(previous.folder, previous.manifest, request.backupFile);
      }
      if (previous.folder === (await currentTarget(this.options.home, previous.folder))) {
        // `current` still points at it (the switch never happened).
      } else {
        await pointCurrentAt(this.options.home, previous.folder);
      }
    } catch (error) {
      this.dependencies.log(
        `Going back hit a problem too: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      await maintenance?.close();
      this.launch(previous.folder, previous.manifest);
    }
  }

  /**
   * A failed update puts the database back as it was before the new version's migrations
   * touched it. A failed roll back leaves the data alone: the backup it would use is older.
   */
  private shouldRestoreAfterFailure(request: SwitchRequest, migrationsStarted: boolean): boolean {
    return request.kind === "update" && migrationsStarted;
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

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/** Where a release's program is, for `runProgram` and `startServer`. */
export function programPath(folder: string, script: string): string {
  return join(folder, script);
}
