import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  inArray,
  isNull,
  not,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { animationMimeTypes } from "./file-types.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { usersTable as usersDefinition } from "../users/users.table.js";
import { type AssetRow, assetsTable as assetsDefinition, type NewAssetRow } from "./media.table.js";
import type { AssetKind } from "./media.schema.js";
import { insertReturning } from "../database/dialect/writes.js";
import { likeIgnoringCase } from "../database/dialect/expressions.js";
import { tableFor } from "../database/dialect/mysql-tables.js";

/** Database reads and writes for assets, nothing else. */

/** An asset row with the name of whoever uploaded it, for the API's `uploadedBy`. */
export interface AssetRowWithUploader extends AssetRow {
  uploaderName: string | null;
}

/** The columns editors can change. */
export type AssetChanges = Partial<
  Pick<AssetRow, "alt" | "credit" | "creditDetails" | "focalX" | "focalY" | "filename" | "siteId">
>;

export interface AssetListFilter {
  search?: string;
  kind?: AssetKind;
  /** One folder: a site's id, or null for the shared library. Left out, every file. */
  siteId?: string | null;
  /** Only pictures whose description is empty. */
  missingAlt?: boolean;
  limit: number;
  offset: number;
}

function assetWithUploaderColumns(database: DatabaseOrTransaction) {
  const assetsTable = tableFor(database, assetsDefinition);
  const usersTable = tableFor(database, usersDefinition);
  return {
    ...getTableColumns(assetsTable),
    uploaderName: usersTable.name,
  };
}

export async function findAssetById(
  database: DatabaseOrTransaction,
  tenantId: string,
  assetId: string,
): Promise<AssetRowWithUploader | undefined> {
  const assetsTable = tableFor(database, assetsDefinition);
  const usersTable = tableFor(database, usersDefinition);
  const [asset] = await database
    .select(assetWithUploaderColumns(database))
    .from(assetsTable)
    .leftJoin(usersTable, eq(usersTable.id, assetsTable.uploadedBy))
    .where(and(eq(assetsTable.tenantId, tenantId), eq(assetsTable.id, assetId)))
    .limit(1);
  return asset;
}

export async function findAssetsByIdList(
  database: DatabaseOrTransaction,
  tenantId: string,
  assetIds: readonly string[],
): Promise<AssetRow[]> {
  const assetsTable = tableFor(database, assetsDefinition);
  if (assetIds.length === 0) {
    return [];
  }
  return database
    .select()
    .from(assetsTable)
    .where(and(eq(assetsTable.tenantId, tenantId), inArray(assetsTable.id, [...assetIds])));
}

export async function findAssetIdByContentHash(
  database: DatabaseOrTransaction,
  tenantId: string,
  contentHash: string,
): Promise<string | undefined> {
  const assetsTable = tableFor(database, assetsDefinition);
  const [asset] = await database
    .select({ id: assetsTable.id })
    .from(assetsTable)
    .where(and(eq(assetsTable.tenantId, tenantId), eq(assetsTable.contentHash, contentHash)))
    .limit(1);
  return asset?.id;
}

/** Newest first, with the total that match so the admin can offer more pages. */
export async function listAssetRows(
  database: DatabaseOrTransaction,
  tenantId: string,
  filter: AssetListFilter,
): Promise<{ rows: AssetRowWithUploader[]; total: number }> {
  const assetsTable = tableFor(database, assetsDefinition);
  const usersTable = tableFor(database, usersDefinition);
  const where = and(eq(assetsTable.tenantId, tenantId), ...listConditions(database, filter));

  const rows = await database
    .select(assetWithUploaderColumns(database))
    .from(assetsTable)
    .leftJoin(usersTable, eq(usersTable.id, assetsTable.uploadedBy))
    .where(where)
    // The id breaks ties between uploads in the same instant, so pages never overlap.
    .orderBy(desc(assetsTable.createdAt), desc(assetsTable.id))
    .limit(filter.limit)
    .offset(filter.offset);
  const [counted] = await database.select({ total: count() }).from(assetsTable).where(where);

  return { rows, total: counted?.total ?? 0 };
}

export async function insertAsset(
  database: DatabaseOrTransaction,
  asset: NewAssetRow,
): Promise<AssetRow> {
  const assetsTable = tableFor(database, assetsDefinition);
  const [inserted] = await insertReturning(database, assetsTable, asset);
  if (!inserted) {
    throw new Error("The database did not return the new asset.");
  }
  return inserted;
}

export async function updateAssetRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  assetId: string,
  changes: AssetChanges,
): Promise<void> {
  const assetsTable = tableFor(database, assetsDefinition);
  await database
    .update(assetsTable)
    .set(changes)
    .where(and(eq(assetsTable.tenantId, tenantId), eq(assetsTable.id, assetId)));
}

export async function deleteAssetRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  assetId: string,
): Promise<void> {
  const assetsTable = tableFor(database, assetsDefinition);
  await database
    .delete(assetsTable)
    .where(and(eq(assetsTable.tenantId, tenantId), eq(assetsTable.id, assetId)));
}

function listConditions(database: DatabaseOrTransaction, filter: AssetListFilter): SQL[] {
  const assetsTable = tableFor(database, assetsDefinition);
  const conditions: SQL[] = [];

  if (filter.search) {
    const pattern = `%${escapeLikePattern(filter.search)}%`;
    const matchesText = or(
      likeIgnoringCase(database, assetsTable.filename, pattern),
      likeIgnoringCase(database, assetsTable.alt, pattern),
    );
    if (matchesText) {
      conditions.push(matchesText);
    }
  }
  if (filter.kind === "image") {
    conditions.push(likeIgnoringCase(database, assetsTable.mimeType, "image/%"));
  }
  if (filter.siteId === null) {
    conditions.push(isNull(assetsTable.siteId));
  } else if (filter.siteId !== undefined) {
    conditions.push(eq(assetsTable.siteId, filter.siteId));
  }
  if (filter.kind === "document") {
    conditions.push(
      not(likeIgnoringCase(database, assetsTable.mimeType, "image/%")),
      not(likeIgnoringCase(database, assetsTable.mimeType, "model/%")),
    );
  }
  if (filter.kind === "model") {
    conditions.push(likeIgnoringCase(database, assetsTable.mimeType, "model/%"));
  }
  if (filter.kind === "animation") {
    conditions.push(inArray(assetsTable.mimeType, [...animationMimeTypes]));
  }
  if (filter.missingAlt) {
    conditions.push(
      likeIgnoringCase(database, assetsTable.mimeType, "image/%"),
      sql`trim(${assetsTable.alt}) = ''`,
    );
  }

  return conditions;
}

/** A search for "50%" or "my_file" means those characters, not LIKE's wildcards. */
function escapeLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, (character) => `\\${character}`);
}

/** Every stored file's key, oldest first, for moving files from one storage to another. */
export async function listAllStorageKeys(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<{ storageKey: string; mimeType: string }[]> {
  const assetsTable = tableFor(database, assetsDefinition);
  return database
    .select({ storageKey: assetsTable.storageKey, mimeType: assetsTable.mimeType })
    .from(assetsTable)
    .where(eq(assetsTable.tenantId, tenantId))
    .orderBy(assetsTable.createdAt);
}
