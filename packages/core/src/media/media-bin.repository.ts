import { and, desc, eq } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import { sitesTable as sitesDefinition } from "../sites/sites.table.js";
import { usersTable as usersDefinition } from "../users/users.table.js";
import {
  type BinnedAssetRow,
  binnedAssetsTable as binnedAssetsDefinition,
  type NewBinnedAssetRow,
} from "./media-bin.table.js";
import { tableFor } from "../database/dialect/mysql-tables.js";

/** Database reads and writes for deleted files. Rules live in media-bin.service.ts. */

export async function insertBinnedAsset(
  database: DatabaseOrTransaction,
  binned: NewBinnedAssetRow,
): Promise<void> {
  const binnedAssetsTable = tableFor(database, binnedAssetsDefinition);
  await database.insert(binnedAssetsTable).values(binned);
}

export async function findBinnedAsset(
  database: DatabaseOrTransaction,
  tenantId: string,
  assetId: string,
): Promise<BinnedAssetRow | undefined> {
  const binnedAssetsTable = tableFor(database, binnedAssetsDefinition);
  const [row] = await database
    .select()
    .from(binnedAssetsTable)
    .where(and(eq(binnedAssetsTable.tenantId, tenantId), eq(binnedAssetsTable.id, assetId)));
  return row;
}

/** Newest first, with the name of whoever deleted each, while they're still around. */
export async function listBinnedAssetRows(
  database: DatabaseOrTransaction,
  tenantId: string,
  limit: number,
): Promise<{ binned: BinnedAssetRow; deletedByName: string | null }[]> {
  const binnedAssetsTable = tableFor(database, binnedAssetsDefinition);
  const usersTable = tableFor(database, usersDefinition);
  return database
    .select({ binned: binnedAssetsTable, deletedByName: usersTable.name })
    .from(binnedAssetsTable)
    .leftJoin(usersTable, eq(usersTable.id, binnedAssetsTable.deletedBy))
    .where(eq(binnedAssetsTable.tenantId, tenantId))
    .orderBy(desc(binnedAssetsTable.deletedAt))
    .limit(limit);
}

export async function listAllBinnedAssets(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<BinnedAssetRow[]> {
  const binnedAssetsTable = tableFor(database, binnedAssetsDefinition);
  return database.select().from(binnedAssetsTable).where(eq(binnedAssetsTable.tenantId, tenantId));
}

export async function deleteBinnedAssetRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  assetId: string,
): Promise<void> {
  const binnedAssetsTable = tableFor(database, binnedAssetsDefinition);
  await database
    .delete(binnedAssetsTable)
    .where(and(eq(binnedAssetsTable.tenantId, tenantId), eq(binnedAssetsTable.id, assetId)));
}

export async function userExists(
  database: DatabaseOrTransaction,
  userId: string,
): Promise<boolean> {
  const usersTable = tableFor(database, usersDefinition);
  const [row] = await database
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  return row !== undefined;
}

export async function siteExists(
  database: DatabaseOrTransaction,
  siteId: string,
): Promise<boolean> {
  const sitesTable = tableFor(database, sitesDefinition);
  const [row] = await database
    .select({ id: sitesTable.id })
    .from(sitesTable)
    .where(eq(sitesTable.id, siteId));
  return row !== undefined;
}
