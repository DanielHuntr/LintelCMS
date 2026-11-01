import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { listAllStorageKeys } from "./media.repository.js";
import type { StorageDriver } from "./storage-driver.js";

/**
 * Copies every uploaded file from one storage to another, such as from this server's disk
 * to an S3 bucket (`pnpm media:move-to-s3`). Files already at the destination are skipped,
 * so a move that stopped half way can simply be run again. Nothing is deleted from the
 * source: the person checks the site first, then removes the old files themselves.
 */

export interface StorageMoveOptions {
  database: DatabaseOrTransaction;
  from: StorageDriver;
  to: StorageDriver;
  /** Count what would be copied, without copying anything. */
  dryRun?: boolean;
  /** Told about each file as it is handled, for a progress line. */
  onFile?: (key: string, outcome: StorageMoveOutcome) => void;
}

export type StorageMoveOutcome = "copied" | "already-there" | "missing";

export interface StorageMoveReport {
  copied: number;
  alreadyThere: number;
  /** Files the database knows about but the source storage doesn't have. */
  missing: string[];
}

export async function copyStoredFiles(options: StorageMoveOptions): Promise<StorageMoveReport> {
  const report: StorageMoveReport = { copied: 0, alreadyThere: 0, missing: [] };
  const files = await listAllStorageKeys(options.database, DEFAULT_TENANT_ID);

  for (const file of files) {
    const outcome = await copyOneFile(options, file.storageKey, file.mimeType);
    if (outcome === "copied") report.copied += 1;
    if (outcome === "already-there") report.alreadyThere += 1;
    if (outcome === "missing") report.missing.push(file.storageKey);
    options.onFile?.(file.storageKey, outcome);
  }
  return report;
}

async function copyOneFile(
  options: StorageMoveOptions,
  key: string,
  mimeType: string,
): Promise<StorageMoveOutcome> {
  if (await options.to.exists(key)) {
    return "already-there";
  }
  if (!(await options.from.exists(key))) {
    return "missing";
  }
  if (!options.dryRun) {
    const stream = await options.from.get(key);
    await options.to.put(key, Buffer.concat(await stream.toArray()), mimeType);
  }
  return "copied";
}
