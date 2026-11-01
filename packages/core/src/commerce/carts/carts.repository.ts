import { and, asc, eq, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../database/client.js";
import { type CartLineRow, cartLinesTable, type CartRow, cartsTable } from "./carts.table.js";

/** Database reads and writes for carts and their lines. */

export async function findCartRowByTokenHash(
  database: DatabaseOrTransaction,
  tokenHash: string,
): Promise<CartRow | undefined> {
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
  const [row] = await database.select().from(cartsTable).where(eq(cartsTable.id, cartId)).limit(1);
  return row;
}

export async function insertCart(
  database: DatabaseOrTransaction,
  cart: typeof cartsTable.$inferInsert,
): Promise<CartRow> {
  const [inserted] = await database.insert(cartsTable).values(cart).returning();
  if (!inserted) throw new Error("Saving the cart returned nothing");
  return inserted;
}

export async function updateCartRow(
  database: DatabaseOrTransaction,
  cartId: string,
  changes: Partial<typeof cartsTable.$inferInsert>,
): Promise<void> {
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
  await database
    .insert(cartLinesTable)
    .values(line)
    .onConflictDoUpdate({
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
  const updated = await database
    .update(cartLinesTable)
    .set({ quantity })
    .where(and(eq(cartLinesTable.cartId, cartId), eq(cartLinesTable.id, lineId)))
    .returning({ id: cartLinesTable.id });
  return updated.length > 0;
}

export async function deleteCartLine(
  database: DatabaseOrTransaction,
  cartId: string,
  lineId: string,
): Promise<boolean> {
  const deleted = await database
    .delete(cartLinesTable)
    .where(and(eq(cartLinesTable.cartId, cartId), eq(cartLinesTable.id, lineId)))
    .returning({ id: cartLinesTable.id });
  return deleted.length > 0;
}

export async function deleteAllCartLines(
  database: DatabaseOrTransaction,
  cartId: string,
): Promise<void> {
  await database.delete(cartLinesTable).where(eq(cartLinesTable.cartId, cartId));
}
