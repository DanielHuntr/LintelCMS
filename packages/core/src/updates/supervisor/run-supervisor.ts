import { type ChildProcess, fork } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { FolderDatabaseCopies, locateDatabase } from "./database-copies.js";
import { openMaintenancePage } from "./maintenance-page.js";
import {
  programPath,
  type ServerProcess,
  Supervisor,
  type SupervisorDependencies,
} from "./supervisor.js";

/**
 * `lintel start`: runs the supervisor for real, with the server as a child process of this
 * one. The home folder is LINTEL_HOME or the folder it is started in. Settings come from
 * <home>/.env and the environment; LINTEL_FOLDER defaults to <home>/.lintel, so every
 * version shares the same database, uploads and backups.
 */
export interface RunSupervisorOptions {
  home: string;
  /** The release `lintel start` belongs to, run until `current` exists. */
  installFolder: string;
  installVersion: string;
  log?: (message: string) => void;
}

export async function runSupervisor(options: RunSupervisorOptions): Promise<Supervisor> {
  const home = resolve(options.home);
  const log = options.log ?? ((message: string) => process.stdout.write(`[lintel] ${message}\n`));
  const environFile = join(home, ".env");
  if (existsSync(environFile)) {
    process.loadEnvFile(environFile);
  }
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV ?? "production",
    LINTEL_FOLDER: process.env.LINTEL_FOLDER ?? join(home, ".lintel"),
    LINTEL_SUPERVISED: "1",
    LINTEL_HOME: home,
  };
  const port = Number(environment.PORT ?? environment.API_PORT ?? 4000);
  const host = environment.HOST ?? "0.0.0.0";
  const readyUrl = `http://127.0.0.1:${port}/ready`;
  // The server runs in <home>, so a relative LINTEL_FOLDER is relative to it.
  const database = locateDatabase(
    environment,
    resolve(home, environment.LINTEL_FOLDER ?? ".lintel"),
  );

  const dependencies: SupervisorDependencies = {
    startServer(folder, manifest) {
      return wrapChild(
        fork(programPath(folder, manifest.start), [], {
          cwd: home,
          env: {
            ...environment,
            ADMIN_BUILD_FOLDER: environment.ADMIN_BUILD_FOLDER ?? join(folder, manifest.admin),
          },
          stdio: ["inherit", "inherit", "inherit", "ipc"],
        }),
      );
    },
    runProgram(folder, script, argumentList) {
      const child = fork(programPath(folder, script), argumentList, {
        cwd: home,
        env: environment,
        stdio: ["ignore", "inherit", "inherit", "ipc"],
      });
      return new Promise((done) => {
        child.once("error", () => done(1));
        child.once("exit", (code) => done(code ?? 1));
      });
    },
    openMaintenancePage: () => openMaintenancePage({ port, host, home }),
    async isReady() {
      try {
        const response = await fetch(readyUrl, { signal: AbortSignal.timeout(3_000) });
        return response.ok;
      } catch {
        return false;
      }
    },
    sleep: (milliseconds) => sleep(milliseconds),
    log,
    now: () => new Date(),
    databaseCopies:
      database.kind === "built-in" ? new FolderDatabaseCopies(home, database.dataFolder) : null,
  };

  const supervisor = new Supervisor(
    { home, fallbackFolder: options.installFolder, fallbackVersion: options.installVersion },
    dependencies,
  );
  await supervisor.start();
  log(`Lintel ${supervisor.runningVersion ?? ""} is starting; updates are installed from ${home}`);

  const stop = () => {
    void supervisor.stop().then(() => process.exit(0));
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
  return supervisor;
}

function wrapChild(child: ChildProcess): ServerProcess {
  const exited = new Promise<number | null>((done) => {
    child.once("exit", (code) => done(code));
    child.once("error", () => done(null));
  });
  return {
    exited,
    async stop(timeoutMilliseconds) {
      if (child.exitCode !== null || child.signalCode !== null) {
        return;
      }
      child.kill("SIGTERM");
      const stopped = await Promise.race([
        exited.then(() => true),
        sleep(timeoutMilliseconds).then(() => false),
      ]);
      if (!stopped) {
        child.kill("SIGKILL");
        await exited;
      }
    },
    onMessage(listener) {
      child.on("message", listener);
    },
  };
}
