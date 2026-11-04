import { and, asc, eq, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../database/client.js";
import {
  type CartLineRow,
  cartLinesTable as cartLinesDefinition,
  type CartRow,
  cartsTable as cartsDefinition,
} from "./carts.table.js";
import {
  deleteReturning,
  insertReturning,
  updateReturning,
  upsert,
} from "../../database/dialect/writes.js";
import { tableFor } from "../../database/dialect/mysql-tables.js";

/** Database reads and writes for carts and their lines. */

export async function findCartRowByTokenHash(
  database: DatabaseOrTransaction,
  tokenHash: string,
): Promise<CartRow | undefined> {
  const cartsTable = tableFor(database, cartsDefinition);
  const [row] = await database
    .select()
    .from(cartsTable)
    .where(eq(cartsTable.tokenHash, tokenHash))
    .limit(1);
  return row;
}

export async function findCartRow(
  database: DatabaseOrTransaction,
  cartId: string,
): Promise<CartRow | undefined> {
  const cartsTable = tableFor(database, cartsDefinition);
  const [row] = await database.select().from(cartsTable).where(eq(cartsTable.id, cartId)).limit(1);
  return row;
}

export async function insertCart(
  database: DatabaseOrTransaction,
  cart: typeof cartsDefinition.$inferInsert,
): Promise<CartRow> {
  const cartsTable = tableFor(database, cartsDefinition);
  const [inserted] = await insertReturning(database, cartsTable, cart);
  if (!inserted) throw new Error("Saving the cart returned nothing");
  return inserted;
}

export async function updateCartRow(
  database: DatabaseOrTransaction,
  cartId: string,
  changes: Partial<typeof cartsDefinition.$inferInsert>,
): Promise<void> {
  const cartsTable = tableFor(database, cartsDefinition);
  // Always touch updatedAt, so a cart changed only through its lines still counts as used.
  await database
    .update(cartsTable)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(cartsTable.id, cartId));
}

export async function listCartLineRows(
  database: DatabaseOrTransaction,
  cartId: string,
): Promise<CartLineRow[]> {
  const cartLinesTable = tableFor(database, cartLinesDefinition);
  return database
    .select()
    .from(cartLinesTable)
    .where(eq(cartLinesTable.cartId, cartId))
    .orderBy(asc(cartLinesTable.createdAt), asc(cartLinesTable.id));
}

/** Adds to the line for this variant, or starts one. */
export async function addToCartLine(
  database: DatabaseOrTransaction,
  line: { tenantId: string; cartId: string; variantId: string; quantity: number },
): Promise<void> {
  const cartLinesTable = tableFor(database, cartLinesDefinition);
  await upsert(database, cartLinesTable, line, {
    target: [cartLinesTable.cartId, cartLinesTable.variantId],
    set: { quantity: sql`${cartLinesTable.quantity} + ${line.quantity}` },
  });
}

export async function setCartLineQuantity(
  database: DatabaseOrTransaction,
  cartId: string,
  lineId: string,
  quantity: number,
): Promise<boolean> {
  const cartLinesTable = tableFor(database, cartLinesDefinition);
  const updated = await updateReturning(
    database,
    cartLinesTable,
    { quantity },
    and(eq(cartLinesTable.cartId, cartId), eq(cartLinesTable.id, lineId)),
    { id: cartLinesTable.id },
  );
  return updated.length > 0;
}

export async function deleteCartLine(
  database: DatabaseOrTransaction,
  cartId: string,
  lineId: string,
): Promise<boolean> {
  const cartLinesTable = tableFor(database, cartLinesDefinition);
  const deleted = await deleteReturning(
    database,
    cartLinesTable,
    and(eq(cartLinesTable.cartId, cartId), eq(cartLinesTable.id, lineId)),
    { id: cartLinesTable.id },
  );
  return deleted.length > 0;
}

export async function deleteAllCartLines(
  database: DatabaseOrTransaction,
  cartId: string,
): Promise<void> {
  const cartLinesTable = tableFor(database, cartLinesDefinition);
  await database.delete(cartLinesTable).where(eq(cartLinesTable.cartId, cartId));
}
