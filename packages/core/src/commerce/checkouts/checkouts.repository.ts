import { and, eq, lte } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../database/client.js";
import { type CheckoutRow, checkoutsTable, type NewCheckoutRow } from "./checkouts.table.js";

/** Database reads and writes for checkouts. */

export async function insertCheckout(
  database: DatabaseOrTransaction,
  checkout: NewCheckoutRow,
): Promise<CheckoutRow> {
  const [inserted] = await database.insert(checkoutsTable).values(checkout).returning();
  if (!inserted) throw new Error("Saving the checkout returned nothing");
  return inserted;
}

export async function findCheckoutRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  checkoutId: string,
): Promise<CheckoutRow | undefined> {
  const [row] = await database
    .select()
    .from(checkoutsTable)
    .where(and(eq(checkoutsTable.tenantId, tenantId), eq(checkoutsTable.id, checkoutId)))
    .limit(1);
  return row;
}

/**
 * Reads a checkout and locks it until the transaction ends, so a payment webhook and a
 * duplicate of it (or the expiry job) can't both act on it at once.
 */
export async function lockCheckoutRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  checkoutId: string,
): Promise<CheckoutRow | undefined> {
  const [row] = await database
    .select()
    .from(checkoutsTable)
    .where(and(eq(checkoutsTable.tenantId, tenantId), eq(checkoutsTable.id, checkoutId)))
    .limit(1)
    .for("update");
  return row;
}

export async function findCheckoutRowBySession(
  database: DatabaseOrTransaction,
  sessionId: string,
): Promise<CheckoutRow | undefined> {
  const [row] = await database
    .select()
    .from(checkoutsTable)
    .where(eq(checkoutsTable.stripeCheckoutSessionId, sessionId))
    .limit(1);
  return row;
}

export async function listOpenCheckoutRowsForCart(
  database: DatabaseOrTransaction,
  cartId: string,
): Promise<CheckoutRow[]> {
  return database
    .select()
    .from(checkoutsTable)
    .where(and(eq(checkoutsTable.cartId, cartId), eq(checkoutsTable.status, "open")))
    .for("update");
}

export async function listExpiredOpenCheckoutRows(
  database: DatabaseOrTransaction,
  now: Date,
): Promise<CheckoutRow[]> {
  return database
    .select()
    .from(checkoutsTable)
    .where(and(eq(checkoutsTable.status, "open"), lte(checkoutsTable.expiresAt, now)))
    .limit(200);
}

export async function updateCheckoutRow(
  database: DatabaseOrTransaction,
  checkoutId: string,
  changes: Partial<NewCheckoutRow>,
): Promise<void> {
  await database.update(checkoutsTable).set(changes).where(eq(checkoutsTable.id, checkoutId));
}

/** Moves a checkout from open to expired; false when it had already moved on. */
export async function expireOpenCheckoutRow(
  database: DatabaseOrTransaction,
  checkoutId: string,
): Promise<boolean> {
  const updated = await database
    .update(checkoutsTable)
    .set({ status: "expired" })
    .where(and(eq(checkoutsTable.id, checkoutId), eq(checkoutsTable.status, "open")))
    .returning({ id: checkoutsTable.id });
  return updated.length > 0;
}
