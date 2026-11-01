import { z } from "zod";
import type { ZipArchiveReader } from "../archives/zip-reader.js";
import { checksumOfFiles } from "../archives/zip-writer.js";
import { listKnownMigrations } from "../database/migration-status.js";
import {
  BACKUP_FORMAT_VERSION,
  type BackupManifest,
  backupManifestSchema,
  MANIFEST_FILE,
} from "./backup-manifest.js";
import {
  BackupDamagedError,
  BackupFromNewerLintelError,
  NotABackupError,
} from "./backups.errors.js";

/**
 * Reads a backup's manifest and checks the whole archive against it: the format, that this
 * Lintel knows every migration the backup's database had, and every file's SHA-256.
 * Throws a named error for the first problem found.
 */
export async function readVerifiedManifest(reader: ZipArchiveReader): Promise<BackupManifest> {
  const manifest = await readManifest(reader);
  if (manifest.formatVersion > BACKUP_FORMAT_VERSION) {
    throw new BackupFromNewerLintelError();
  }
  const known = new Set(listKnownMigrations());
  if (manifest.migrations.some((migration) => !known.has(migration))) {
    throw new BackupFromNewerLintelError();
  }
  if (checksumOfFiles(manifest.files) !== manifest.checksum) {
    throw new BackupDamagedError(MANIFEST_FILE);
  }
  for (const file of manifest.files) {
    if (!reader.has(file.path) || reader.sizeOf(file.path) !== file.size) {
      throw new BackupDamagedError(file.path);
    }
    if ((await reader.hashOf(file.path)) !== file.sha256) {
      throw new BackupDamagedError(file.path);
    }
  }
  return manifest;
}

async function readManifest(reader: ZipArchiveReader): Promise<BackupManifest> {
  if (!reader.has(MANIFEST_FILE)) {
    throw new NotABackupError("it has no manifest.json");
  }
  let json: unknown;
  try {
    json = await reader.readJson(MANIFEST_FILE);
  } catch {
    throw new NotABackupError("its manifest.json can't be read");
  }
  const parsed = backupManifestSchema.safeParse(json);
  if (!parsed.success) {
    throw new NotABackupError(z.prettifyError(parsed.error).split("\n")[0] ?? "unknown layout");
  }
  return parsed.data;
}
