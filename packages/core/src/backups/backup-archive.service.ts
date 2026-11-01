import { getTableName } from "drizzle-orm";
import { checksumOfFiles, ZipArchiveWriter } from "../archives/zip-writer.js";
import { ZipArchiveReader } from "../archives/zip-reader.js";
import type { Database, DatabaseKind } from "../database/client.js";
import { listKnownMigrations } from "../database/migration-status.js";
import type { StorageDriver } from "../media/storage-driver.js";
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  type BackupContents,
  type BackupManifest,
  MANIFEST_FILE,
  mediaFile,
  SETTINGS_FILE,
  tableFile,
} from "./backup-manifest.js";
import { readVerifiedManifest } from "./backup-verification.js";
import {
  countRows,
  emptyTables,
  insertAllRows,
  readAllRows,
  readAllSettings,
  replaceAllSettings,
  type TableRow,
} from "./database-snapshot.repository.js";
import type { RestoreSummary } from "./backups.schema.js";
import { listBackedUpTables } from "./table-order.js";

/**
 * Writing a whole site into one .zip, and putting it back. Used by Settings → Backups and
 * by `lintel backup` / `lintel restore`, which is why it takes plain paths and knows
 * nothing about HTTP or the backups list.
 */
export interface BackupArchiveContext {
  database: Database;
  databaseKind: DatabaseKind;
  storage: StorageDriver;
}

export interface WrittenBackup {
  size: number;
  checksum: string;
  contents: BackupContents;
}

export async function writeBackupArchive(
  context: BackupArchiveContext,
  path: string,
): Promise<WrittenBackup> {
  const writer = await ZipArchiveWriter.create(path);
  try {
    const tables = await addDatabase(context.database, writer);
    const media = await addMedia(context.storage, writer, tables.assets);
    const contents: BackupContents = { tables: tables.counts, ...media };
    const files = [...writer.listFiles()];
    const manifest: BackupManifest = {
      format: BACKUP_FORMAT,
      formatVersion: BACKUP_FORMAT_VERSION,
      createdAt: new Date().toISOString(),
      databaseKind: context.databaseKind,
      migrations: listKnownMigrations(),
      contents,
      files,
      checksum: checksumOfFiles(files),
    };
    writer.addJson(MANIFEST_FILE, manifest);
    const size = await writer.finish();
    return { size, checksum: manifest.checksum, contents };
  } catch (error) {
    await writer.abandon();
    throw error;
  }
}

/**
 * Reads every table in one read-only snapshot, so a page saved half way through a backup
 * is either wholly in it or not at all.
 */
async function addDatabase(database: Database, writer: ZipArchiveWriter) {
  return database.transaction(
    async (transaction) => {
      const counts: Record<string, number> = {};
      let assets: TableRow[] = [];
      for (const table of listBackedUpTables()) {
        const name = getTableName(table);
        const rows = await readAllRows(transaction, table);
        writer.addJson(tableFile(name), rows);
        counts[name] = rows.length;
        if (name === "assets") {
          assets = rows;
        }
      }
      writer.addJson(SETTINGS_FILE, await readAllSettings(transaction));
      return { counts, assets };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

async function addMedia(storage: StorageDriver, writer: ZipArchiveWriter, assets: TableRow[]) {
  let mediaFiles = 0;
  let mediaBytes = 0;
  const missingMediaFiles: string[] = [];
  for (const asset of assets) {
    const storageKey = String(asset.storage_key);
    if (!(await storage.exists(storageKey))) {
      missingMediaFiles.push(String(asset.filename));
      continue;
    }
    await writer.addStream(mediaFile(storageKey), await storage.get(storageKey));
    mediaFiles += 1;
    mediaBytes += writer.listFiles().at(-1)?.size ?? 0;
  }
  return { mediaFiles, mediaBytes, missingMediaFiles };
}

/** Checks a backup and says what restoring it would replace, without changing anything. */
export async function inspectBackupArchive(
  context: BackupArchiveContext,
  path: string,
): Promise<RestoreSummary> {
  const reader = await ZipArchiveReader.open(path);
  try {
    const manifest = await readVerifiedManifest(reader);
    return await summariseRestore(context.database, manifest);
  } finally {
    reader.close();
  }
}

/**
 * Replaces this site's content, settings and media with the backup's. The archive is
 * checked in full first, so a damaged one changes nothing. Files go into storage before
 * the database changes, and the database changes in one transaction: if anything fails,
 * the site is as it was (plus some unused files, which are tidied on the next restore).
 */
export async function restoreBackupArchive(
  context: BackupArchiveContext,
  path: string,
): Promise<RestoreSummary> {
  const reader = await ZipArchiveReader.open(path);
  try {
    const manifest = await readVerifiedManifest(reader);
    const summary = await summariseRestore(context.database, manifest);
    const previousKeys = await listStorageKeys(context.database);
    const restoredKeys = await putMediaFiles(context.storage, reader);
    await replaceDatabase(context.database, reader);
    for (const key of previousKeys) {
      if (!restoredKeys.has(key)) {
        await context.storage.delete(key);
      }
    }
    return summary;
  } finally {
    reader.close();
  }
}

async function summariseRestore(
  database: Database,
  manifest: BackupManifest,
): Promise<RestoreSummary> {
  const tables = [];
  for (const table of listBackedUpTables()) {
    const name = getTableName(table);
    tables.push({
      table: name,
      inBackup: manifest.contents.tables[name] ?? 0,
      current: await countRows(database, table),
    });
  }
  const settingsFile = manifest.files.find((file) => file.path === SETTINGS_FILE);
  return {
    createdAt: manifest.createdAt,
    tables,
    mediaFiles: manifest.contents.mediaFiles,
    settings: settingsFile ? 1 : 0,
  };
}

async function listStorageKeys(database: Database): Promise<string[]> {
  const assetsTable = listBackedUpTables().find((table) => getTableName(table) === "assets");
  const rows = assetsTable ? await readAllRows(database, assetsTable) : [];
  return rows.map((row) => String(row.storage_key));
}

async function putMediaFiles(storage: StorageDriver, reader: ZipArchiveReader) {
  const assets = reader.has(tableFile("assets"))
    ? ((await reader.readJson(tableFile("assets"))) as TableRow[])
    : [];
  const restored = new Set<string>();
  for (const asset of assets) {
    const storageKey = String(asset.storage_key);
    if (reader.has(mediaFile(storageKey))) {
      await storage.put(
        storageKey,
        await reader.readBuffer(mediaFile(storageKey)),
        String(asset.mime_type),
      );
      restored.add(storageKey);
    }
  }
  return restored;
}

async function replaceDatabase(database: Database, reader: ZipArchiveReader): Promise<void> {
  const tables = listBackedUpTables();
  const rowsByTable = new Map<string, TableRow[]>();
  for (const table of tables) {
    const name = getTableName(table);
    const rows = reader.has(tableFile(name)) ? await reader.readJson(tableFile(name)) : [];
    rowsByTable.set(name, Array.isArray(rows) ? (rows as TableRow[]) : []);
  }
  const settings = reader.has(SETTINGS_FILE) ? await reader.readJson(SETTINGS_FILE) : {};

  await database.transaction(async (transaction) => {
    await emptyTables(transaction, tables);
    for (const table of tables) {
      await insertAllRows(transaction, table, rowsByTable.get(getTableName(table)) ?? []);
    }
    await replaceAllSettings(transaction, isRecord(settings) ? settings : {});
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
