import { and, asc, eq, inArray } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../database/client.js";
import {
  type NewShippingRateRow,
  type ShippingRateRow,
  shippingRatesTable as shippingRatesDefinition,
  type ShippingZoneRow,
  shippingZonesTable as shippingZonesDefinition,
} from "./shipping.table.js";
import {
  deleteReturning,
  insertReturning,
  updateReturning,
} from "../../database/dialect/writes.js";
import { tableFor } from "../../database/dialect/mysql-tables.js";

/** Database reads and writes for shipping zones and their rates. */

export async function listZoneRows(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<ShippingZoneRow[]> {
  const shippingZonesTable = tableFor(database, shippingZonesDefinition);
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
  const shippingRatesTable = tableFor(database, shippingRatesDefinition);
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
  const shippingRatesTable = tableFor(database, shippingRatesDefinition);
  const [row] = await database
    .select()
    .from(shippingRatesTable)
    .where(and(eq(shippingRatesTable.tenantId, tenantId), eq(shippingRatesTable.id, rateId)))
    .limit(1);
  return row;
}

export async function insertZone(
  database: DatabaseOrTransaction,
  zone: typeof shippingZonesDefinition.$inferInsert,
): Promise<ShippingZoneRow> {
  const shippingZonesTable = tableFor(database, shippingZonesDefinition);
  const [inserted] = await insertReturning(database, shippingZonesTable, zone);
  if (!inserted) throw new Error("Saving the shipping zone returned nothing");
  return inserted;
}

export async function updateZoneRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  zoneId: string,
  changes: Partial<Pick<ShippingZoneRow, "name" | "countries">>,
): Promise<boolean> {
  const shippingZonesTable = tableFor(database, shippingZonesDefinition);
  const updated = await updateReturning(
    database,
    shippingZonesTable,
    changes,
    and(eq(shippingZonesTable.tenantId, tenantId), eq(shippingZonesTable.id, zoneId)),
    { id: shippingZonesTable.id },
  );
  return updated.length > 0;
}

export async function deleteZoneRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  zoneId: string,
): Promise<boolean> {
  const shippingZonesTable = tableFor(database, shippingZonesDefinition);
  const deleted = await deleteReturning(
    database,
    shippingZonesTable,
    and(eq(shippingZonesTable.tenantId, tenantId), eq(shippingZonesTable.id, zoneId)),
    { id: shippingZonesTable.id },
  );
  return deleted.length > 0;
}

export async function insertRate(
  database: DatabaseOrTransaction,
  rate: NewShippingRateRow,
): Promise<ShippingRateRow> {
  const shippingRatesTable = tableFor(database, shippingRatesDefinition);
  const [inserted] = await insertReturning(database, shippingRatesTable, rate);
  if (!inserted) throw new Error("Saving the shipping rate returned nothing");
  return inserted;
}

export async function updateRateRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  rateId: string,
  changes: Partial<NewShippingRateRow>,
): Promise<void> {
  const shippingRatesTable = tableFor(database, shippingRatesDefinition);
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
  const shippingRatesTable = tableFor(database, shippingRatesDefinition);
  const deleted = await deleteReturning(
    database,
    shippingRatesTable,
    and(eq(shippingRatesTable.tenantId, tenantId), eq(shippingRatesTable.id, rateId)),
    { id: shippingRatesTable.id },
  );
  return deleted.length > 0;
}
