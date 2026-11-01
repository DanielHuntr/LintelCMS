import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  ConfigError,
  countAppliedMigrations,
  DataFolderInUseError,
  DEFAULT_LINTEL_FOLDER,
  describeDatabaseError,
  loadConfig,
  openWithoutMigrating,
  targetFromUrl,
} from "@lintel/core/data-tools";
import type { DatabaseProbe, PortProbe, SettingsProbe } from "./doctor-checks.js";

/** Finding things out on this machine, for the checks in doctor-checks.ts. */

const runFile = promisify(execFile);

/** pnpm's version: from the environment when run through pnpm, else by asking it. */
export async function findPnpmVersion(): Promise<string | null> {
  const fromAgent = /pnpm\/(\d+\.\d+\.\d+)/.exec(process.env.npm_config_user_agent ?? "")?.[1];
  if (fromAgent) {
    return fromAgent;
  }
  try {
    const { stdout } = await runFile("pnpm", ["--version"], { timeout: 10_000 });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

export function probeSettings(): SettingsProbe {
  try {
    loadConfig();
    return { ok: true };
  } catch (error) {
    if (error instanceof ConfigError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

export async function probeDatabase(databaseUrl: string | undefined): Promise<DatabaseProbe> {
  try {
    const { opened, description } = await openWithoutMigrating(databaseUrl, DEFAULT_LINTEL_FOLDER);
    try {
      return {
        reachable: true,
        description,
        appliedMigrations: await countAppliedMigrations(opened.database),
      };
    } finally {
      await opened.close();
    }
  } catch (error) {
    if (error instanceof DataFolderInUseError) {
      return { reachable: false, inUse: true, message: error.message };
    }
    const described = databaseUrl
      ? describeDatabaseError(error, targetFromUrl(databaseUrl), "environment")
      : undefined;
    const message = described?.message ?? (error instanceof Error ? error.message : String(error));
    return { reachable: false, inUse: false, message };
  }
}

/** Null when a file can be written and removed in the folder, else what went wrong. */
export async function probeWritableFolder(folder: string): Promise<string | null> {
  const testFile = join(folder, `.lintel-doctor-${process.pid}`);
  try {
    await mkdir(folder, { recursive: true });
    await writeFile(testFile, "Lintel doctor checks it can write here. Safe to delete.");
    await rm(testFile);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

export async function probePort(port: number): Promise<PortProbe> {
  const free = await new Promise<boolean>((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.listen(port, () => server.close(() => resolve(true)));
  });
  if (free) {
    return "free";
  }
  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    const body = (await response.json()) as { status?: unknown };
    return body.status === "ok" ? "lintel" : "taken";
  } catch {
    return "taken";
  }
}
