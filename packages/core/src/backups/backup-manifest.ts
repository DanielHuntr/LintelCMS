import { z } from "zod";

/**
 * manifest.json, the first thing read from a backup. It says what made the archive, which
 * database schema the rows fit, and the SHA-256 of every other file, so a damaged or
 * edited archive is caught before anything is replaced.
 *
 * `formatVersion` goes up only when the archive layout changes in a way older Lintels
 * can't read. Layout:
 *
 *   manifest.json
 *   settings.json             every site setting, by key
 *   database/<table>.json     the rows of each table
 *   media/<storage key>       every uploaded file
 */
export const BACKUP_FORMAT = "lintel-backup";
export const BACKUP_FORMAT_VERSION = 1;
export const MANIFEST_FILE = "manifest.json";
export const SETTINGS_FILE = "settings.json";

export const backupContentsSchema = z.object({
  /** Rows per table. */
  tables: z.record(z.string(), z.number().int().nonnegative()),
  mediaFiles: z.number().int().nonnegative(),
  mediaBytes: z.number().int().nonnegative(),
  /** Assets whose file wasn't in storage when the backup was made. */
  missingMediaFiles: z.array(z.string()).default([]),
});

export type BackupContents = z.infer<typeof backupContentsSchema>;

export const backupManifestSchema = z.object({
  format: z.literal(BACKUP_FORMAT, { error: "This isn't a Lintel backup" }),
  formatVersion: z.number().int().positive(),
  createdAt: z.string(),
  /** "built-in" or "postgres": where it was made. Either can restore it. */
  databaseKind: z.string(),
  /** The migrations the database had, oldest first. */
  migrations: z.array(z.string()),
  contents: backupContentsSchema,
  files: z.array(
    z.object({
      path: z.string(),
      size: z.number().int().nonnegative(),
      sha256: z.string().regex(/^[0-9a-f]{64}$/),
    }),
  ),
  checksum: z.string().regex(/^[0-9a-f]{64}$/),
});

export type BackupManifest = z.infer<typeof backupManifestSchema>;

export function tableFile(tableName: string): string {
  return `database/${tableName}.json`;
}

export function mediaFile(storageKey: string): string {
  return `media/${storageKey}`;
}
