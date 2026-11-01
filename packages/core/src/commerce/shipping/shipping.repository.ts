import { and, asc, eq, inArray } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../database/client.js";
import {
  type NewShippingRateRow,
  type ShippingRateRow,
  shippingRatesTable,
  type ShippingZoneRow,
  shippingZonesTable,
} from "./shipping.table.js";

/** Database reads and writes for shipping zones and their rates. */

export async function listZoneRows(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<ShippingZoneRow[]> {
  return database
    .select()
    .from(shippingZonesTable)
    .where(eq(shippingZonesTable.tenantId, tenantId))
    .orderBy(asc(shippingZonesTable.position), asc(shippingZonesTable.createdAt));
}

export async function listRateRows(
  database: DatabaseOrTransaction,
  zoneIds: readonly string[],
): Promise<ShippingRateRow[]> {
  if (zoneIds.length === 0) return [];
  return database
    .select()
    .from(shippingRatesTable)
    .where(inArray(shippingRatesTable.zoneId, [...zoneIds]))
    .orderBy(asc(shippingRatesTable.position), asc(shippingRatesTable.createdAt));
}

export async function findRateRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  rateId: string,
): Promise<ShippingRateRow | undefined> {
  const [row] = await database
    .select()
    .from(shippingRatesTable)
    .where(and(eq(shippingRatesTable.tenantId, tenantId), eq(shippingRatesTable.id, rateId)))
    .limit(1);
  return row;
}

export async function insertZone(
  database: DatabaseOrTransaction,
  zone: typeof shippingZonesTable.$inferInsert,
): Promise<ShippingZoneRow> {
  const [inserted] = await database.insert(shippingZonesTable).values(zone).returning();
  if (!inserted) throw new Error("Saving the shipping zone returned nothing");
  return inserted;
}

export async function updateZoneRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  zoneId: string,
  changes: Partial<Pick<ShippingZoneRow, "name" | "countries">>,
): Promise<boolean> {
  const updated = await database
    .update(shippingZonesTable)
    .set(changes)
    .where(and(eq(shippingZonesTable.tenantId, tenantId), eq(shippingZonesTable.id, zoneId)))
    .returning({ id: shippingZonesTable.id });
  return updated.length > 0;
}

export async function deleteZoneRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  zoneId: string,
): Promise<boolean> {
  const deleted = await database
    .delete(shippingZonesTable)
    .where(and(eq(shippingZonesTable.tenantId, tenantId), eq(shippingZonesTable.id, zoneId)))
    .returning({ id: shippingZonesTable.id });
  return deleted.length > 0;
}

export async function insertRate(
  database: DatabaseOrTransaction,
  rate: NewShippingRateRow,
): Promise<ShippingRateRow> {
  const [inserted] = await database.insert(shippingRatesTable).values(rate).returning();
  if (!inserted) throw new Error("Saving the shipping rate returned nothing");
  return inserted;
}

export async function updateRateRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  rateId: string,
  changes: Partial<NewShippingRateRow>,
): Promise<void> {
  await database
    .update(shippingRatesTable)
    .set(changes)
    .where(and(eq(shippingRatesTable.tenantId, tenantId), eq(shippingRatesTable.id, rateId)));
}

export async function deleteRateRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  rateId: string,
): Promise<boolean> {
  const deleted = await database
    .delete(shippingRatesTable)
    .where(and(eq(shippingRatesTable.tenantId, tenantId), eq(shippingRatesTable.id, rateId)))
    .returning({ id: shippingRatesTable.id });
  return deleted.length > 0;
}
