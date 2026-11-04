import { and, count, eq, inArray, max, notInArray, or } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../database/client.js";
import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import { checkoutsTable as checkoutsDefinition } from "../checkouts/checkouts.table.js";
import { customersTable as customersDefinition } from "../customers/customers.table.js";
import { discountRedemptionsTable as discountRedemptionsDefinition } from "../discounts/discounts.table.js";
import { type OrderRow, ordersTable as ordersDefinition } from "../orders/orders.table.js";
import { shopSettingsTable as shopSettingsDefinition } from "../settings/shop-settings.table.js";
import { archivedOrdersTable as archivedOrdersDefinition } from "../shopify-import/shopify-import.table.js";
import { tableFor } from "../../database/dialect/mysql-tables.js";

/** Database reads and writes for clearing test orders away. */

export async function countTestOrderRows(database: DatabaseOrTransaction): Promise<number> {
  const ordersTable = tableFor(database, ordersDefinition);
  const [total] = await database
    .select({ value: count() })
    .from(ordersTable)
    .where(and(eq(ordersTable.tenantId, DEFAULT_TENANT_ID), eq(ordersTable.isTest, true)));
  return total?.value ?? 0;
}

export async function lockTestOrderRows(database: DatabaseOrTransaction): Promise<OrderRow[]> {
  const ordersTable = tableFor(database, ordersDefinition);
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
  const ordersTable = tableFor(database, ordersDefinition);
  if (orderIds.length === 0) return;
  await database
    .delete(ordersTable)
    .where(and(inArray(ordersTable.id, [...orderIds]), eq(ordersTable.isTest, true)));
}

export async function listOpenTestCheckoutIds(database: DatabaseOrTransaction): Promise<string[]> {
  const checkoutsTable = tableFor(database, checkoutsDefinition);
  const rows = await database
    .select({ id: checkoutsTable.id })
    .from(checkoutsTable)
    .where(and(eq(checkoutsTable.paymentProvider, "test"), eq(checkoutsTable.status, "open")));
  return rows.map((row) => row.id);
}

/**
 * Test checkouts, and the checkouts of the orders given. An order paid with a provider's test
 * keys has an ordinary checkout, which must go with it: left behind, it would look unpaid, and
 * a late message from the provider would place the order again.
 */
export async function deleteTestCheckoutRows(
  database: DatabaseOrTransaction,
  orderCheckoutIds: readonly string[],
): Promise<void> {
  const checkoutsTable = tableFor(database, checkoutsDefinition);
  await database
    .delete(checkoutsTable)
    .where(
      or(
        eq(checkoutsTable.paymentProvider, "test"),
        orderCheckoutIds.length > 0 ? inArray(checkoutsTable.id, [...orderCheckoutIds]) : undefined,
      ),
    );
}

/** Gives back the discount uses test orders took, so a limited code isn't used up. */
export async function releaseOrderRedemptions(
  database: DatabaseOrTransaction,
  orderIds: readonly string[],
): Promise<void> {
  const discountRedemptionsTable = tableFor(database, discountRedemptionsDefinition);
  if (orderIds.length === 0) return;
  await database
    .update(discountRedemptionsTable)
    .set({ status: "released" })
    .where(inArray(discountRedemptionsTable.orderId, [...orderIds]));
}

/**
 * Removes customers who only existed because of test orders: made by one (a new customer gets
 * the same time as the order that made them), nothing left that's theirs, and no note anyone
 * wrote about them. Someone already there, such as an imported customer with no orders here,
 * stays even when a test used their address.
 */
export async function deleteCustomersLeftEmpty(
  database: DatabaseOrTransaction,
  orders: ReadonlyArray<Pick<OrderRow, "customerId" | "createdAt">>,
): Promise<void> {
  const archivedOrdersTable = tableFor(database, archivedOrdersDefinition);
  const customersTable = tableFor(database, customersDefinition);
  const ordersTable = tableFor(database, ordersDefinition);
  const firstOrders = new Map<string, number>();
  for (const { customerId, createdAt } of orders) {
    if (!customerId) continue;
    const first = firstOrders.get(customerId) ?? Infinity;
    firstOrders.set(customerId, Math.min(first, createdAt.getTime()));
  }
  if (firstOrders.size === 0) return;
  const candidates = await database
    .select({ id: customersTable.id, createdAt: customersTable.createdAt })
    .from(customersTable)
    .where(inArray(customersTable.id, [...firstOrders.keys()]));
  const customerIds = candidates
    .filter(({ id, createdAt }) => createdAt.getTime() >= (firstOrders.get(id) ?? Infinity))
    .map(({ id }) => id);
  if (customerIds.length === 0) return;
  const withOrders = await database
    .selectDistinct({ id: ordersTable.customerId })
    .from(ordersTable)
    .where(inArray(ordersTable.customerId, customerIds));
  const withArchivedOrders = await database
    .selectDistinct({ id: archivedOrdersTable.customerId })
    .from(archivedOrdersTable)
    .where(inArray(archivedOrdersTable.customerId, customerIds));
  const kept = [...withOrders, ...withArchivedOrders].flatMap((row) => row.id ?? []);
  await database
    .delete(customersTable)
    .where(
      and(
        inArray(customersTable.id, customerIds),
        eq(customersTable.note, ""),
        kept.length > 0 ? notInArray(customersTable.id, kept) : undefined,
      ),
    );
}

/** The highest order number still in use, or undefined with no orders left. */
export async function findHighestOrderNumber(
  database: DatabaseOrTransaction,
): Promise<number | undefined> {
  const ordersTable = tableFor(database, ordersDefinition);
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
  const shopSettingsTable = tableFor(database, shopSettingsDefinition);
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
