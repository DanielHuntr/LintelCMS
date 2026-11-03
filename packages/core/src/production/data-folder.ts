import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateSetupCode } from "../setup/setup-code.js";

/**
 * The data folder (`.lintel`, or LINTEL_FOLDER) holds the built-in database, uploads and
 * saved settings, so Lintel can't do anything useful without writing to it. It is checked
 * at start, so a host that made the folder read-only gets a plain explanation instead of a
 * database error on the first click.
 */
export class DataFolderNotWritableError extends Error {
  constructor(folder: string, reason: string) {
    super(
      `Lintel can't save files in its data folder, ${folder} (${reason}). ` +
        "It keeps the built-in database, uploads and settings there. Give the account Lintel " +
        "runs as permission to write to that folder (in cPanel: File Manager, then " +
        "Permissions, 755 for folders), or set LINTEL_FOLDER to a folder it can write to.",
    );
    this.name = "DataFolderNotWritableError";
  }
}

export function checkDataFolderIsWritable(folder: string): void {
  const probe = join(folder, `.write-check-${process.pid}`);
  try {
    mkdirSync(folder, { recursive: true });
    writeFileSync(probe, "ok");
    rmSync(probe, { force: true });
  } catch (error) {
    throw new DataFolderNotWritableError(folder, describeFileProblem(error));
  }
}

function describeFileProblem(error: unknown): string {
  const code = error instanceof Error && "code" in error ? String(error.code) : "";
  switch (code) {
    case "EACCES":
    case "EPERM":
      return "permission denied";
    case "EROFS":
      return "the disk is read-only";
    case "ENOSPC":
      return "the disk is full";
    case "EDQUOT":
      return "the account's disk quota is used up";
    default:
      return error instanceof Error ? error.message : String(error);
  }
}

/**
 * The setup code, kept in `setup-code.txt` in the data folder until setup is done. Shared
 * hosts stop the app when nobody visits and some run more than one copy; with the code in a
 * file, every copy and every restart asks for the same one, and people without a terminal
 * can read it with the host's file manager.
 */
export function setupCodeFile(folder: string): string {
  return join(folder, "setup-code.txt");
}

export function readOrCreateSetupCode(folder: string): string {
  const file = setupCodeFile(folder);
  try {
    const saved = readFileSync(file, "utf8").trim();
    if (/^\d{4}-\d{4}$/.test(saved)) return saved;
  } catch {
    // No code yet: make one below.
  }
  const code = generateSetupCode();
  writeFileSync(file, `${code}\n`, { mode: 0o600 });
  return code;
}

export function forgetSetupCode(folder: string): void {
  rmSync(setupCodeFile(folder), { force: true });
}
