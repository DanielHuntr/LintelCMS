import { and, asc, eq, ne, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../database/client.js";
import { type MarketRow, marketsTable, type NewMarketRow } from "./markets.table.js";

/** Database reads and writes for markets. */

export async function listMarketRows(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<MarketRow[]> {
  return database
    .select()
    .from(marketsTable)
    .where(eq(marketsTable.tenantId, tenantId))
    .orderBy(
      sql`${marketsTable.isPrimary} desc`,
      asc(marketsTable.position),
      asc(marketsTable.createdAt),
    );
}

export async function findMarketRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  marketId: string,
): Promise<MarketRow | undefined> {
  const [row] = await database
    .select()
    .from(marketsTable)
    .where(and(eq(marketsTable.tenantId, tenantId), eq(marketsTable.id, marketId)))
    .limit(1);
  return row;
}

export async function insertMarket(
  database: DatabaseOrTransaction,
  market: NewMarketRow,
): Promise<MarketRow> {
  const [inserted] = await database.insert(marketsTable).values(market).returning();
  if (!inserted) {
    throw new Error("Saving the market returned nothing");
  }
  return inserted;
}

export async function updateMarketRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  marketId: string,
  changes: Partial<Omit<MarketRow, "id" | "tenantId" | "createdAt" | "updatedAt">>,
): Promise<void> {
  await database
    .update(marketsTable)
    .set(changes)
    .where(and(eq(marketsTable.tenantId, tenantId), eq(marketsTable.id, marketId)));
}

/** Every other market stops being primary, so there is only ever one. */
export async function clearOtherPrimaryMarkets(
  database: DatabaseOrTransaction,
  tenantId: string,
  primaryMarketId: string,
): Promise<void> {
  await database
    .update(marketsTable)
    .set({ isPrimary: false })
    .where(and(eq(marketsTable.tenantId, tenantId), ne(marketsTable.id, primaryMarketId)));
}

export async function deleteMarketRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  marketId: string,
): Promise<boolean> {
  const deleted = await database
    .delete(marketsTable)
    .where(and(eq(marketsTable.tenantId, tenantId), eq(marketsTable.id, marketId)))
    .returning({ id: marketsTable.id });
  return deleted.length > 0;
}
