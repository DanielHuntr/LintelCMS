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
  fillInColumns,
  findExistingTables,
  insertAllRows,
  readAllRows,
  readAllSettings,
  replaceAllSettings,
  type TableRow,
} from "./database-snapshot.repository.js";
import type { RestoreSummary } from "./backups.schema.js";
import {
  columnsPointingForward,
  listBackedUpTables,
  TABLES_LEFT_OUT_OF_BACKUPS,
} from "./table-order.js";

/**
 * Writing a whole site into one .zip, and putting it back. Used by Settings → Backups and
 * by `lintel backup` / `lintel restore`, which is why it takes plain paths and knows
 * nothing about HTTP or the backups list.
 */
export interface BackupArchiveContext {
  database: Database;
  databaseKind: DatabaseKind;
  storage: StorageDriver;
  /**
   * Add-ons' and plugins' own tables, by name, as they declare them (see
   * src/addons/addon-tables.ts). Each one in the database is backed up after Lintel's own,
   * and restored when the backup has it.
   */
  addonTables?: readonly string[];
}

/** The add-on tables of this context that are in the database, leaving out Lintel's own. */
async function presentAddonTables(
  database: Database,
  context: BackupArchiveContext,
): Promise<string[]> {
  const own = new Set(listBackedUpTables().map((table) => getTableName(table)));
  const named = [...new Set(context.addonTables ?? [])].filter(
    (name) => !own.has(name) && !TABLES_LEFT_OUT_OF_BACKUPS.includes(name),
  );
  return findExistingTables(database, named);
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
    const tables = await addDatabase(
      context.database,
      writer,
      await presentAddonTables(context.database, context),
    );
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
async function addDatabase(
  database: Database,
  writer: ZipArchiveWriter,
  addonTables: readonly string[],
) {
  return database.transaction(
    async (transaction) => {
      const counts: Record<string, number> = {};
      let assets: TableRow[] = [];
      for (const table of [...listBackedUpTables(), ...addonTables]) {
        const name = typeof table === "string" ? table : getTableName(table);
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
    return await summariseRestore(
      context.database,
      manifest,
      restorableAddonTables(manifest, await presentAddonTables(context.database, context)),
    );
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
    const addonTables = restorableAddonTables(
      manifest,
      await presentAddonTables(context.database, context),
    );
    const summary = await summariseRestore(context.database, manifest, addonTables);
    const previousKeys = await listStorageKeys(context.database);
    const restoredKeys = await putMediaFiles(context.storage, reader);
    await replaceDatabase(context.database, reader, addonTables);
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

/**
 * The add-on tables a restore puts back: those the backup holds and the database has now.
 * One the backup doesn't have (the add-on came later) is left as it is.
 */
function restorableAddonTables(manifest: BackupManifest, present: readonly string[]): string[] {
  return present.filter((name) => manifest.contents.tables[name] !== undefined);
}

async function summariseRestore(
  database: Database,
  manifest: BackupManifest,
  addonTables: readonly string[],
): Promise<RestoreSummary> {
  const tables = [];
  for (const table of [...listBackedUpTables(), ...addonTables]) {
    const name = typeof table === "string" ? table : getTableName(table);
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

async function replaceDatabase(
  database: Database,
  reader: ZipArchiveReader,
  addonTables: readonly string[],
): Promise<void> {
  const tables = listBackedUpTables();
  const rowsByTable = new Map<string, TableRow[]>();
  for (const name of [...tables.map((table) => getTableName(table)), ...addonTables]) {
    const rows = reader.has(tableFile(name)) ? await reader.readJson(tableFile(name)) : [];
    rowsByTable.set(name, Array.isArray(rows) ? (rows as TableRow[]) : []);
  }
  const settings = reader.has(SETTINGS_FILE) ? await reader.readJson(SETTINGS_FILE) : {};

  const forwardColumns = columnsPointingForward(tables);

  await database.transaction(async (transaction) => {
    // Add-ons' tables go in after Lintel's, since they may point at Lintel's rows.
    await emptyTables(transaction, [...tables, ...addonTables]);
    for (const table of tables) {
      const name = getTableName(table);
      await insertAllRows(
        transaction,
        table,
        rowsByTable.get(name) ?? [],
        forwardColumns.get(name) ?? [],
      );
    }
    for (const [name, columns] of forwardColumns) {
      const table = tables.find((candidate) => getTableName(candidate) === name);
      if (table) {
        await fillInColumns(transaction, table, rowsByTable.get(name) ?? [], columns);
      }
    }
    for (const name of addonTables) {
      await insertAllRows(transaction, name, rowsByTable.get(name) ?? []);
    }
    await replaceAllSettings(transaction, isRecord(settings) ? settings : {});
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
