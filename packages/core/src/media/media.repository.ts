import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  ilike,
  inArray,
  isNull,
  not,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import { usersTable } from "../users/users.table.js";
import { type AssetRow, assetsTable, type NewAssetRow } from "./media.table.js";
import type { AssetKind } from "./media.schema.js";

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

const assetWithUploaderColumns = {
  ...getTableColumns(assetsTable),
  uploaderName: usersTable.name,
};

export async function findAssetById(
  database: DatabaseOrTransaction,
  tenantId: string,
  assetId: string,
): Promise<AssetRowWithUploader | undefined> {
  const [asset] = await database
    .select(assetWithUploaderColumns)
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
  const where = and(eq(assetsTable.tenantId, tenantId), ...listConditions(filter));

  const rows = await database
    .select(assetWithUploaderColumns)
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
  const [inserted] = await database.insert(assetsTable).values(asset).returning();
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
  await database
    .delete(assetsTable)
    .where(and(eq(assetsTable.tenantId, tenantId), eq(assetsTable.id, assetId)));
}

function listConditions(filter: AssetListFilter): SQL[] {
  const conditions: SQL[] = [];

  if (filter.search) {
    const pattern = `%${escapeLikePattern(filter.search)}%`;
    const matchesText = or(ilike(assetsTable.filename, pattern), ilike(assetsTable.alt, pattern));
    if (matchesText) {
      conditions.push(matchesText);
    }
  }
  if (filter.kind === "image") {
    conditions.push(ilike(assetsTable.mimeType, "image/%"));
  }
  if (filter.siteId === null) {
    conditions.push(isNull(assetsTable.siteId));
  } else if (filter.siteId !== undefined) {
    conditions.push(eq(assetsTable.siteId, filter.siteId));
  }
  if (filter.kind === "document") {
    conditions.push(
      not(ilike(assetsTable.mimeType, "image/%")),
      not(ilike(assetsTable.mimeType, "model/%")),
    );
  }
  if (filter.kind === "model") {
    conditions.push(ilike(assetsTable.mimeType, "model/%"));
  }
  if (filter.missingAlt) {
    conditions.push(ilike(assetsTable.mimeType, "image/%"), sql`trim(${assetsTable.alt}) = ''`);
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
  return database
    .select({ storageKey: assetsTable.storageKey, mimeType: assetsTable.mimeType })
    .from(assetsTable)
    .where(eq(assetsTable.tenantId, tenantId))
    .orderBy(assetsTable.createdAt);
}
