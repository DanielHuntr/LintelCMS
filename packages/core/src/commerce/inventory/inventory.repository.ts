import { and, asc, eq, gt, inArray, lte, notInArray, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../database/client.js";
import { variantsTable as variantsDefinition } from "../products/products.table.js";
import {
  type InventoryLevelRow,
  inventoryLevelsTable as inventoryLevelsDefinition,
  type InventoryLocationRow,
  inventoryLocationsTable as inventoryLocationsDefinition,
  inventoryReservationsTable as inventoryReservationsDefinition,
} from "./inventory.table.js";
import {
  deleteReturning,
  insertReturning,
  updateReturning,
  upsert,
} from "../../database/dialect/writes.js";
import { lockOnly } from "../../database/dialect/reads.js";
import { tableFor } from "../../database/dialect/mysql-tables.js";

/** Database reads and writes for locations, stock levels and reservations. */

export async function listLocationRows(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<InventoryLocationRow[]> {
  const inventoryLocationsTable = tableFor(database, inventoryLocationsDefinition);
  return database
    .select()
    .from(inventoryLocationsTable)
    .where(eq(inventoryLocationsTable.tenantId, tenantId))
    .orderBy(asc(inventoryLocationsTable.position), asc(inventoryLocationsTable.createdAt));
}

export async function insertLocation(
  database: DatabaseOrTransaction,
  location: typeof inventoryLocationsDefinition.$inferInsert,
): Promise<InventoryLocationRow> {
  const inventoryLocationsTable = tableFor(database, inventoryLocationsDefinition);
  const [inserted] = await insertReturning(database, inventoryLocationsTable, location);
  if (!inserted) {
    throw new Error("Saving the location returned nothing");
  }
  return inserted;
}

export async function updateLocationRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  locationId: string,
  changes: Partial<Pick<InventoryLocationRow, "name" | "isActive" | "position">>,
): Promise<boolean> {
  const inventoryLocationsTable = tableFor(database, inventoryLocationsDefinition);
  const updated = await updateReturning(
    database,
    inventoryLocationsTable,
    changes,
    and(eq(inventoryLocationsTable.tenantId, tenantId), eq(inventoryLocationsTable.id, locationId)),
    { id: inventoryLocationsTable.id },
  );
  return updated.length > 0;
}

export async function deleteLocationRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  locationId: string,
): Promise<boolean> {
  const inventoryLocationsTable = tableFor(database, inventoryLocationsDefinition);
  const deleted = await deleteReturning(
    database,
    inventoryLocationsTable,
    and(eq(inventoryLocationsTable.tenantId, tenantId), eq(inventoryLocationsTable.id, locationId)),
    { id: inventoryLocationsTable.id },
  );
  return deleted.length > 0;
}

export async function listLevelRows(
  database: DatabaseOrTransaction,
  variantIds: readonly string[],
): Promise<InventoryLevelRow[]> {
  const inventoryLevelsTable = tableFor(database, inventoryLevelsDefinition);
  if (variantIds.length === 0) return [];
  return database
    .select()
    .from(inventoryLevelsTable)
    .where(inArray(inventoryLevelsTable.variantId, [...variantIds]));
}

export async function upsertLevel(
  database: DatabaseOrTransaction,
  level: { tenantId: string; variantId: string; locationId: string; onHand: number },
): Promise<void> {
  const inventoryLevelsTable = tableFor(database, inventoryLevelsDefinition);
  await upsert(database, inventoryLevelsTable, level, {
    target: [inventoryLevelsTable.variantId, inventoryLevelsTable.locationId],
    set: { onHand: level.onHand },
  });
}

/**
 * Locks the stock levels of these variants until the transaction ends (SELECT ... FOR
 * UPDATE), so a second checkout for the same variant waits here instead of reading the
 * same numbers. Locked in variant order, so two checkouts never wait for each other.
 */
export async function lockLevelRows(
  database: DatabaseOrTransaction,
  variantIds: readonly string[],
): Promise<InventoryLevelRow[]> {
  const inventoryLevelsTable = tableFor(database, inventoryLevelsDefinition);
  const inventoryLocationsTable = tableFor(database, inventoryLocationsDefinition);
  if (variantIds.length === 0) return [];
  return database
    .select({
      id: inventoryLevelsTable.id,
      tenantId: inventoryLevelsTable.tenantId,
      variantId: inventoryLevelsTable.variantId,
      locationId: inventoryLevelsTable.locationId,
      onHand: inventoryLevelsTable.onHand,
      createdAt: inventoryLevelsTable.createdAt,
      updatedAt: inventoryLevelsTable.updatedAt,
    })
    .from(inventoryLevelsTable)
    .innerJoin(
      inventoryLocationsTable,
      eq(inventoryLocationsTable.id, inventoryLevelsTable.locationId),
    )
    .where(
      and(
        inArray(inventoryLevelsTable.variantId, [...variantIds]),
        eq(inventoryLocationsTable.isActive, true),
      ),
    )
    .orderBy(
      asc(inventoryLevelsTable.variantId),
      asc(inventoryLocationsTable.position),
      asc(inventoryLocationsTable.createdAt),
    )
    .for("update", lockOnly(database, inventoryLevelsTable));
}

/** Locks one variant's row, so a variant with no stock levels yet still queues checkouts. */
export async function lockVariantRows(
  database: DatabaseOrTransaction,
  variantIds: readonly string[],
): Promise<Array<{ id: string; title: string; inventoryTracked: boolean }>> {
  const variantsTable = tableFor(database, variantsDefinition);
  if (variantIds.length === 0) return [];
  return database
    .select({
      id: variantsTable.id,
      title: variantsTable.title,
      inventoryTracked: variantsTable.inventoryTracked,
    })
    .from(variantsTable)
    .where(inArray(variantsTable.id, [...variantIds]))
    .orderBy(asc(variantsTable.id))
    .for("update");
}

export async function changeOnHand(
  database: DatabaseOrTransaction,
  levelId: string,
  change: number,
): Promise<void> {
  const inventoryLevelsTable = tableFor(database, inventoryLevelsDefinition);
  await database
    .update(inventoryLevelsTable)
    .set({ onHand: sql`${inventoryLevelsTable.onHand} + ${change}` })
    .where(eq(inventoryLevelsTable.id, levelId));
}

/** Quantities held by active reservations that haven't expired, by variant. */
export async function sumHeldQuantities(
  database: DatabaseOrTransaction,
  variantIds: readonly string[],
  now: Date,
  exceptCheckoutIds: readonly string[] = [],
): Promise<Map<string, number>> {
  const inventoryReservationsTable = tableFor(database, inventoryReservationsDefinition);
  if (variantIds.length === 0) return new Map();
  const rows = await database
    .select({
      variantId: inventoryReservationsTable.variantId,
      quantity: sql<number>`coalesce(sum(${inventoryReservationsTable.quantity}), 0)`,
    })
    .from(inventoryReservationsTable)
    .where(
      and(
        inArray(inventoryReservationsTable.variantId, [...variantIds]),
        eq(inventoryReservationsTable.status, "active"),
        gt(inventoryReservationsTable.expiresAt, now),
        exceptCheckoutIds.length === 0
          ? undefined
          : notInArray(inventoryReservationsTable.checkoutId, [...exceptCheckoutIds]),
      ),
    )
    .groupBy(inventoryReservationsTable.variantId);
  return new Map(rows.map((row) => [row.variantId, Number(row.quantity)]));
}

export async function insertReservations(
  database: DatabaseOrTransaction,
  reservations: Array<typeof inventoryReservationsDefinition.$inferInsert>,
): Promise<void> {
  const inventoryReservationsTable = tableFor(database, inventoryReservationsDefinition);
  if (reservations.length === 0) return;
  await database.insert(inventoryReservationsTable).values(reservations);
}

/** Moves a checkout's active reservations to `status`; returns how many moved. */
export async function finishCheckoutReservations(
  database: DatabaseOrTransaction,
  checkoutId: string,
  status: "committed" | "released",
): Promise<number> {
  const inventoryReservationsTable = tableFor(database, inventoryReservationsDefinition);
  const updated = await updateReturning(
    database,
    inventoryReservationsTable,
    { status },
    and(
      eq(inventoryReservationsTable.checkoutId, checkoutId),
      eq(inventoryReservationsTable.status, "active"),
    ),
    { id: inventoryReservationsTable.id },
  );
  return updated.length;
}

/** Releases every reservation whose time is up, and says which checkouts they held for. */
export async function releaseExpiredReservationRows(
  database: DatabaseOrTransaction,
  now: Date,
): Promise<string[]> {
  const inventoryReservationsTable = tableFor(database, inventoryReservationsDefinition);
  const released = await updateReturning(
    database,
    inventoryReservationsTable,
    { status: "released" },
    and(
      eq(inventoryReservationsTable.status, "active"),
      lte(inventoryReservationsTable.expiresAt, now),
    ),
    { checkoutId: inventoryReservationsTable.checkoutId },
  );
  return [...new Set(released.map((row) => row.checkoutId))];
}
