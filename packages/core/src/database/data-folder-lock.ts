import { readFileSync, rmSync, writeFileSync } from "node:fs";

/**
 * The built-in database can only be used by one program at a time: two copies of PGlite
 * writing to the same folder would corrupt it, and PGlite doesn't check for that itself.
 * So whoever opens the folder leaves a lock file with their process id next to it.
 *
 * A lock left behind by a program that crashed is taken over, because its process id no
 * longer belongs to a running program.
 */
export class DataFolderInUseError extends Error {
  constructor() {
    super(
      "The built-in database is already in use by another Lintel program (probably `pnpm dev`). " +
        "Stop that one first (Ctrl+C in its terminal), then try again.",
    );
    this.name = "DataFolderInUseError";
  }
}

export interface DataFolderLock {
  release: () => void;
}

export function lockDataFolder(lockFile: string): DataFolderLock {
  const ownerProcessId = readOwnerProcessId(lockFile);
  // This process counts too: opening the folder twice from one program is just as harmful.
  if (ownerProcessId !== undefined) {
    if (isRunning(ownerProcessId)) {
      throw new DataFolderInUseError();
    }
    rmSync(lockFile, { force: true });
  }

  try {
    // "wx" fails if the file appeared in the meantime, so two programs starting at the
    // same moment can't both believe they hold the lock.
    writeFileSync(lockFile, String(process.pid), {
      flag: ownerProcessId === undefined ? "wx" : "w",
    });
  } catch {
    throw new DataFolderInUseError();
  }

  return { release: () => rmSync(lockFile, { force: true }) };
}

function readOwnerProcessId(lockFile: string): number | undefined {
  try {
    const processId = Number.parseInt(readFileSync(lockFile, "utf8"), 10);
    return Number.isInteger(processId) ? processId : undefined;
  } catch {
    return undefined;
  }
}

function isRunning(processId: number): boolean {
  try {
    // Signal 0 sends nothing; it only asks whether the process exists.
    process.kill(processId, 0);
    return true;
  } catch (error) {
    // EPERM means it exists but belongs to someone else, which still counts as running.
    return error instanceof Error && "code" in error && error.code === "EPERM";
  }
}
