import type { DatabaseOrTransaction, Transaction } from "../../database/client.js";
import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import { OutOfStockError } from "./inventory.errors.js";
import {
  changeOnHand,
  finishCheckoutReservations,
  insertLocation,
  insertReservations,
  listLevelRows,
  listLocationRows,
  lockLevelRows,
  lockVariantRows,
  sumHeldQuantities,
  upsertLevel,
} from "./inventory.repository.js";
import type { InventoryLocationRow } from "./inventory.table.js";

/**
 * Stock: how many of each variant are on hand, held for checkouts, and available.
 *
 *   available = on hand (all active locations) − held by unexpired active reservations
 *
 * Reserving happens inside the checkout's transaction with the variants locked, so two
 * shoppers racing for the last one are handled one after the other and only one wins.
 */

export interface StockRequest {
  variantId: string;
  quantity: number;
  /** For the out-of-stock message: "Red / Large T-shirt". */
  title: string;
}

/** The shop's locations, making "Main location" the first time there are none. */
export async function listOrCreateLocations(
  database: DatabaseOrTransaction,
): Promise<InventoryLocationRow[]> {
  const locations = await listLocationRows(database, DEFAULT_TENANT_ID);
  if (locations.length > 0) {
    return locations;
  }
  return [await insertLocation(database, { tenantId: DEFAULT_TENANT_ID, name: "Main location" })];
}

/**
 * Holds stock for a checkout until `expiresAt`. Throws OutOfStockError, changing nothing,
 * if any tracked variant doesn't have enough. Must run inside a transaction: the locks it
 * takes are what make it safe.
 */
export async function reserveStock(
  transaction: Transaction,
  checkoutId: string,
  requests: readonly StockRequest[],
  expiresAt: Date,
  now: Date,
): Promise<void> {
  const quantities = totalQuantities(requests);
  const variants = await lockVariantRows(transaction, [...quantities.keys()]);
  const tracked = variants
    .filter((variant) => variant.inventoryTracked)
    .map((variant) => variant.id);
  const onHand = await sumOnHand(transaction, tracked);
  const held = await sumHeldQuantities(transaction, tracked, now);

  for (const variantId of tracked) {
    const wanted = quantities.get(variantId) ?? 0;
    const available = Math.max(0, (onHand.get(variantId) ?? 0) - (held.get(variantId) ?? 0));
    if (wanted > available) {
      const title =
        requests.find((request) => request.variantId === variantId)?.title ?? "This item";
      throw new OutOfStockError(variantId, title, available);
    }
  }

  await insertReservations(
    transaction,
    tracked.map((variantId) => ({
      tenantId: DEFAULT_TENANT_ID,
      variantId,
      checkoutId,
      quantity: quantities.get(variantId) ?? 0,
      expiresAt,
    })),
  );
}

/** The checkout was abandoned or started again: its stock goes back on sale. */
export async function releaseStock(
  database: DatabaseOrTransaction,
  checkoutId: string,
): Promise<void> {
  await finishCheckoutReservations(database, checkoutId, "released");
}

/**
 * The checkout was paid: stock leaves the shelves, from the first active location that has
 * it, then the next. Returns the variants that went below zero, which can only happen when
 * a payment arrives after its reservation was released; the order notes it for staff.
 */
export async function takeStockForOrder(
  transaction: Transaction,
  checkoutId: string,
  requests: readonly StockRequest[],
): Promise<string[]> {
  const quantities = totalQuantities(requests);
  const variants = await lockVariantRows(transaction, [...quantities.keys()]);
  const tracked = variants
    .filter((variant) => variant.inventoryTracked)
    .map((variant) => variant.id);
  const levels = await lockLevelRows(transaction, tracked);
  const oversold: string[] = [];

  for (const variantId of tracked) {
    let remaining = quantities.get(variantId) ?? 0;
    const variantLevels = levels.filter((level) => level.variantId === variantId);
    for (const level of variantLevels) {
      const taken = Math.min(remaining, Math.max(0, level.onHand));
      if (taken > 0) {
        await changeOnHand(transaction, level.id, -taken);
        remaining -= taken;
      }
    }
    if (remaining > 0) {
      oversold.push(variantId);
      const first = variantLevels[0];
      if (first) {
        await changeOnHand(transaction, first.id, -remaining);
      }
    }
  }
  await finishCheckoutReservations(transaction, checkoutId, "committed");
  return oversold;
}

/** Puts refunded or cancelled items back, at the first active location. */
export async function restock(
  database: DatabaseOrTransaction,
  items: ReadonlyArray<{ variantId: string; quantity: number }>,
): Promise<void> {
  const [location] = (await listOrCreateLocations(database)).filter((row) => row.isActive);
  if (!location) return;
  const variantIds = items.map((item) => item.variantId);
  const levels = await listLevelRows(database, variantIds);
  for (const item of items) {
    const level = levels.find(
      (row) => row.variantId === item.variantId && row.locationId === location.id,
    );
    if (level) {
      await changeOnHand(database, level.id, item.quantity);
    } else {
      await upsertLevel(database, {
        tenantId: DEFAULT_TENANT_ID,
        variantId: item.variantId,
        locationId: location.id,
        onHand: item.quantity,
      });
    }
  }
}

export interface VariantStock {
  levels: Array<{ locationId: string; onHand: number }>;
  onHand: number;
  held: number;
  available: number;
}

/**
 * Stock for each variant, for the admin and the storefront. A cart passes the checkouts it
 * started itself, so stock it is already holding isn't counted against it.
 */
export async function describeStock(
  database: DatabaseOrTransaction,
  variantIds: readonly string[],
  now: Date,
  ownCheckoutIds: readonly string[] = [],
): Promise<Map<string, VariantStock>> {
  const levels = await listLevelRows(database, variantIds);
  const held = await sumHeldQuantities(database, variantIds, now, ownCheckoutIds);
  // Stock at a location that's switched off isn't for sale, as in reserveStock.
  const activeLocations = new Set(
    (await listLocationRows(database, DEFAULT_TENANT_ID))
      .filter((location) => location.isActive)
      .map((location) => location.id),
  );
  return new Map(
    variantIds.map((variantId) => {
      const variantLevels = levels.filter((level) => level.variantId === variantId);
      const onHand = variantLevels
        .filter((level) => activeLocations.has(level.locationId))
        .reduce((sum, level) => sum + level.onHand, 0);
      const heldQuantity = held.get(variantId) ?? 0;
      return [
        variantId,
        {
          levels: variantLevels.map((level) => ({
            locationId: level.locationId,
            onHand: level.onHand,
          })),
          onHand,
          held: heldQuantity,
          available: Math.max(0, onHand - heldQuantity),
        },
      ];
    }),
  );
}

export async function setStockLevels(
  database: DatabaseOrTransaction,
  variantId: string,
  levels: ReadonlyArray<{ locationId: string; onHand: number }>,
): Promise<void> {
  for (const level of levels) {
    await upsertLevel(database, { tenantId: DEFAULT_TENANT_ID, variantId, ...level });
  }
}

async function sumOnHand(
  database: DatabaseOrTransaction,
  variantIds: readonly string[],
): Promise<Map<string, number>> {
  const levels = await lockLevelRows(database, variantIds);
  const totals = new Map<string, number>();
  for (const level of levels) {
    totals.set(level.variantId, (totals.get(level.variantId) ?? 0) + level.onHand);
  }
  return totals;
}

function totalQuantities(requests: readonly StockRequest[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const request of requests) {
    totals.set(request.variantId, (totals.get(request.variantId) ?? 0) + request.quantity);
  }
  return totals;
}
