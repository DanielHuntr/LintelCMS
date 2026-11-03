import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { LintelFolder } from "../database/database-choice.js";

/**
 * The cron secret Lintel made itself, kept beside the built-in database in the data folder
 * (`.lintel/cron-secret.txt`), readable only by the account Lintel runs as.
 */
export function cronSecretFile(folder: LintelFolder): string {
  return join(dirname(folder.configFile), "cron-secret.txt");
}

export function readCronSecretFile(folder: LintelFolder): string | undefined {
  try {
    const secret = readFileSync(cronSecretFile(folder), "utf8").trim();
    return secret === "" ? undefined : secret;
  } catch {
    return undefined;
  }
}

export function createCronSecretFile(folder: LintelFolder): string {
  const file = cronSecretFile(folder);
  const secret = randomBytes(32).toString("base64url");
  mkdirSync(dirname(file), { recursive: true });
  // "wx": if another process made one a moment ago, keep theirs.
  try {
    writeFileSync(file, `${secret}\n`, { mode: 0o600, flag: "wx" });
    return secret;
  } catch (error) {
    const existing = readCronSecretFile(folder);
    if (existing) return existing;
    throw error;
  }
}
