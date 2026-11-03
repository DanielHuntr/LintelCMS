import { and, count, eq, inArray, max, notInArray } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../database/client.js";
import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import { checkoutsTable } from "../checkouts/checkouts.table.js";
import { customersTable } from "../customers/customers.table.js";
import { discountRedemptionsTable } from "../discounts/discounts.table.js";
import { type OrderRow, ordersTable } from "../orders/orders.table.js";
import { shopSettingsTable } from "../settings/shop-settings.table.js";
import { archivedOrdersTable } from "../shopify-import/shopify-import.table.js";

/** Database reads and writes for clearing test orders away. */

export async function countTestOrderRows(database: DatabaseOrTransaction): Promise<number> {
  const [total] = await database
    .select({ value: count() })
    .from(ordersTable)
    .where(and(eq(ordersTable.tenantId, DEFAULT_TENANT_ID), eq(ordersTable.isTest, true)));
  return total?.value ?? 0;
}

export async function lockTestOrderRows(database: DatabaseOrTransaction): Promise<OrderRow[]> {
  return database
    .select()
    .from(ordersTable)
    .where(and(eq(ordersTable.tenantId, DEFAULT_TENANT_ID), eq(ordersTable.isTest, true)))
    .for("update");
}

/** Only ever test orders; their lines, refunds, parcels and timeline go with them. */
export async function deleteTestOrderRows(
  database: DatabaseOrTransaction,
  orderIds: readonly string[],
): Promise<void> {
  if (orderIds.length === 0) return;
  await database
    .delete(ordersTable)
    .where(and(inArray(ordersTable.id, [...orderIds]), eq(ordersTable.isTest, true)));
}

export async function listOpenTestCheckoutIds(database: DatabaseOrTransaction): Promise<string[]> {
  const rows = await database
    .select({ id: checkoutsTable.id })
    .from(checkoutsTable)
    .where(and(eq(checkoutsTable.paymentProvider, "test"), eq(checkoutsTable.status, "open")));
  return rows.map((row) => row.id);
}

export async function deleteTestCheckoutRows(database: DatabaseOrTransaction): Promise<void> {
  await database.delete(checkoutsTable).where(eq(checkoutsTable.paymentProvider, "test"));
}

/** Gives back the discount uses test orders took, so a limited code isn't used up. */
export async function releaseOrderRedemptions(
  database: DatabaseOrTransaction,
  orderIds: readonly string[],
): Promise<void> {
  if (orderIds.length === 0) return;
  await database
    .update(discountRedemptionsTable)
    .set({ status: "released" })
    .where(inArray(discountRedemptionsTable.orderId, [...orderIds]));
}

/**
 * Removes customers who only existed because of test orders: nothing left that's theirs, and
 * no note anyone wrote about them.
 */
export async function deleteCustomersLeftEmpty(
  database: DatabaseOrTransaction,
  customerIds: readonly string[],
): Promise<void> {
  if (customerIds.length === 0) return;
  const withOrders = await database
    .selectDistinct({ id: ordersTable.customerId })
    .from(ordersTable)
    .where(inArray(ordersTable.customerId, [...customerIds]));
  const withArchivedOrders = await database
    .selectDistinct({ id: archivedOrdersTable.customerId })
    .from(archivedOrdersTable)
    .where(inArray(archivedOrdersTable.customerId, [...customerIds]));
  const kept = [...withOrders, ...withArchivedOrders].flatMap((row) => row.id ?? []);
  await database
    .delete(customersTable)
    .where(
      and(
        inArray(customersTable.id, [...customerIds]),
        eq(customersTable.note, ""),
        kept.length > 0 ? notInArray(customersTable.id, kept) : undefined,
      ),
    );
}

/** The highest order number still in use, or undefined with no orders left. */
export async function findHighestOrderNumber(
  database: DatabaseOrTransaction,
): Promise<number | undefined> {
  const [row] = await database
    .select({ value: max(ordersTable.number) })
    .from(ordersTable)
    .where(eq(ordersTable.tenantId, DEFAULT_TENANT_ID));
  return row?.value ?? undefined;
}

/**
 * Hands back order numbers only test orders used, so the first real order isn't #1004. Moves
 * the counter only if it's still where those orders left it.
 */
export async function rewindNextOrderNumber(
  database: DatabaseOrTransaction,
  from: number,
  to: number,
): Promise<void> {
  await database
    .update(shopSettingsTable)
    .set({ nextOrderNumber: to })
    .where(
      and(
        eq(shopSettingsTable.tenantId, DEFAULT_TENANT_ID),
        eq(shopSettingsTable.nextOrderNumber, from),
      ),
    );
}
