import { randomUUID } from "node:crypto";
import { listAddonTableNames } from "../addons/addon-tables.js";
import { existsSync } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import type { Database, DatabaseKind } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import type { StorageDriver } from "../media/storage-driver.js";
import type { BackgroundTasks } from "../scheduler/background-tasks.js";
import { inspectBackupArchive, writeBackupArchive } from "./backup-archive.service.js";
import {
  BackupFileMissingError,
  BackupNotFoundError,
  BackupNotReadyError,
} from "./backups.errors.js";
import {
  deleteBackupRow,
  failRunningBackups,
  findBackupRow,
  insertBackupRow,
  listBackupRows,
  updateBackupRow,
} from "./backups.repository.js";
import type { BackupResponse, BackupTrigger } from "./backups.schema.js";
import type { BackupRow } from "./backups.table.js";

/**
 * The backups list in Settings → Backups: making a backup, downloading, deleting and
 * uploading one. Archives live in the backups folder (`.lintel/backups` unless set);
 * restoring is in backup-restore.service.ts and the schedule in backup-schedule.service.ts.
 */
export interface BackupsContext {
  database: Database;
  databaseKind: DatabaseKind;
  storage: StorageDriver;
  folder: string;
  tasks: BackgroundTasks;
  /** Add-ons' and plugins' own tables, by name (see BackupArchiveContext). */
  addonTables?: readonly string[];
}

/** The context for a running server: its database, storage and backups folder. */
export function backupsContextFor(server: FastifyInstance): BackupsContext {
  return {
    database: server.database,
    databaseKind: server.activeDatabase.kind,
    storage: server.dataTools.storage,
    folder: server.dataTools.backupsFolder,
    tasks: server.dataTools.tasks,
    addonTables: listAddonTableNames(server.plugins.plugins, server.addons.loaded),
  };
}

export function describeBackup(row: BackupRow): BackupResponse {
  return {
    id: row.id,
    filename: row.filename,
    trigger: row.trigger,
    status: row.status,
    size: row.size,
    checksum: row.checksum,
    contents: row.contents,
    failureReason: row.failureReason,
    createdByName: row.createdByName,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

export async function listBackups(database: Database): Promise<BackupResponse[]> {
  return (await listBackupRows(database, DEFAULT_TENANT_ID)).map(describeBackup);
}

export async function findBackupOrFail(database: Database, backupId: string): Promise<BackupRow> {
  const row = await findBackupRow(database, DEFAULT_TENANT_ID, backupId);
  if (!row) {
    throw new BackupNotFoundError();
  }
  return row;
}

/** Starts a backup and answers straight away; the list shows it "running" until it's done. */
export async function startBackup(
  context: BackupsContext,
  trigger: BackupTrigger,
  createdByName: string | null,
): Promise<BackupResponse> {
  const row = await recordNewBackup(context, trigger, createdByName);
  context.tasks.start(() => writeRecordedBackup(context, row));
  return describeBackup(row);
}

/** Makes a backup and waits for it, for the schedule and for the backup before a restore. */
export async function makeBackup(
  context: BackupsContext,
  trigger: BackupTrigger,
  createdByName: string | null,
): Promise<BackupRow> {
  const row = await recordNewBackup(context, trigger, createdByName);
  await writeRecordedBackup(context, row);
  const finished = await findBackupOrFail(context.database, row.id);
  if (finished.status !== "complete") {
    throw new Error(finished.failureReason ?? "The backup could not be made.");
  }
  return finished;
}

async function recordNewBackup(
  context: BackupsContext,
  trigger: BackupTrigger,
  createdByName: string | null,
): Promise<BackupRow> {
  return insertBackupRow(context.database, {
    filename: backupFilename(new Date()),
    trigger,
    status: "running",
    createdByName,
  });
}

async function writeRecordedBackup(context: BackupsContext, row: BackupRow): Promise<void> {
  try {
    const written = await writeBackupArchive(context, join(context.folder, row.filename));
    await updateBackupRow(context.database, row.id, {
      status: "complete",
      size: written.size,
      checksum: written.checksum,
      contents: written.contents,
      completedAt: new Date(),
    });
  } catch (error) {
    await updateBackupRow(context.database, row.id, {
      status: "failed",
      failureReason: error instanceof Error ? error.message : "The backup could not be made.",
    });
  }
}

/** "lintel-backup-2026-11-01-0930-1a2b3c.zip": sorts by date, and never clashes. */
export function backupFilename(createdAt: Date): string {
  const stamp = createdAt.toISOString().slice(0, 16).replace("T", "-").replace(":", "");
  return `lintel-backup-${stamp}-${randomUUID().slice(0, 6)}.zip`;
}

/** Where a finished backup's archive is, for downloading or restoring. */
export async function findBackupArchive(
  context: Pick<BackupsContext, "database" | "folder">,
  backupId: string,
): Promise<{ row: BackupRow; path: string }> {
  const row = await findBackupOrFail(context.database, backupId);
  if (row.status !== "complete") {
    throw new BackupNotReadyError();
  }
  const path = join(context.folder, row.filename);
  if (!existsSync(path)) {
    throw new BackupFileMissingError(row.filename);
  }
  return { row, path };
}

export async function deleteBackup(context: BackupsContext, backupId: string): Promise<void> {
  const row = await findBackupOrFail(context.database, backupId);
  if (row.status === "running") {
    throw new BackupNotReadyError();
  }
  await rm(join(context.folder, row.filename), { force: true });
  await deleteBackupRow(context.database, row.id);
}

/**
 * Adds an archive made elsewhere (another server, or downloaded earlier) to the list, so it
 * can be restored. It is checked in full first; a damaged file is removed and refused.
 */
export async function addUploadedBackup(
  context: BackupsContext,
  uploadedPath: string,
  createdByName: string | null,
): Promise<BackupResponse> {
  const filename = backupFilename(new Date()).replace("lintel-backup-", "lintel-uploaded-");
  const path = join(context.folder, filename);
  await mkdir(context.folder, { recursive: true });
  await rename(uploadedPath, path);
  try {
    const summary = await inspectBackupArchive(context, path);
    const tables = Object.fromEntries(summary.tables.map((table) => [table.table, table.inBackup]));
    const row = await insertBackupRow(context.database, {
      filename,
      trigger: "uploaded",
      status: "complete",
      contents: { tables, mediaFiles: summary.mediaFiles, mediaBytes: 0, missingMediaFiles: [] },
      createdByName,
      completedAt: new Date(),
    });
    return describeBackup(row);
  } catch (error) {
    await rm(path, { force: true });
    throw error;
  }
}

/** A server that stopped mid-backup left it "running"; on the next start it is marked failed. */
export function markInterruptedBackups(database: Database): Promise<void> {
  return failRunningBackups(
    database,
    DEFAULT_TENANT_ID,
    "Lintel stopped while this backup was being made. Make a new one.",
  );
}
