import { and, count, desc, eq, ilike, inArray, isNull, min, or, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../database/client.js";
import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import { ordersTable } from "../orders/orders.table.js";
import { archivedOrdersTable } from "../shopify-import/shopify-import.table.js";
import { type CustomerRow, customersTable } from "./customers.table.js";

/** Database reads and writes for customers. */

export interface CustomerWithTotals extends CustomerRow {
  orderCount: number;
  /** By currency, since a customer may have bought in more than one market. */
  totalSpent: Array<{ currency: string; amount: number }>;
  /** When their earliest order from before the move (Shopify) was placed, if any. */
  firstArchivedOrderAt: Date | null;
}

export type CustomerTotals = Pick<
  CustomerWithTotals,
  "orderCount" | "totalSpent" | "firstArchivedOrderAt"
>;

/** The customer with this email, made if they're new. Two orders at once still share one. */
export async function findOrCreateCustomerRow(
  database: DatabaseOrTransaction,
  email: string,
  name: string,
): Promise<CustomerRow> {
  await database
    .insert(customersTable)
    .values({ tenantId: DEFAULT_TENANT_ID, email, name })
    .onConflictDoNothing();
  const [row] = await database
    .select()
    .from(customersTable)
    .where(and(eq(customersTable.tenantId, DEFAULT_TENANT_ID), eq(customersTable.email, email)))
    .limit(1);
  if (!row) throw new Error("The customer could not be saved");
  return row;
}

export async function findCustomerRow(
  database: DatabaseOrTransaction,
  customerId: string,
): Promise<CustomerRow | undefined> {
  const [row] = await database
    .select()
    .from(customersTable)
    .where(and(eq(customersTable.tenantId, DEFAULT_TENANT_ID), eq(customersTable.id, customerId)))
    .limit(1);
  return row;
}

export async function updateCustomerRow(
  database: DatabaseOrTransaction,
  customerId: string,
  changes: Partial<Pick<CustomerRow, "name" | "phone" | "note" | "addresses">>,
): Promise<void> {
  await database.update(customersTable).set(changes).where(eq(customersTable.id, customerId));
}

export async function listCustomerRows(
  database: DatabaseOrTransaction,
  search: string | undefined,
  page: { page: number; perPage: number },
): Promise<{ rows: CustomerRow[]; total: number }> {
  const escaped = search?.replace(/[\\%_]/g, (character) => `\\${character}`);
  const where = and(
    eq(customersTable.tenantId, DEFAULT_TENANT_ID),
    escaped
      ? or(ilike(customersTable.email, `%${escaped}%`), ilike(customersTable.name, `%${escaped}%`))
      : undefined,
  );
  const rows = await database
    .select()
    .from(customersTable)
    .where(where)
    .orderBy(desc(customersTable.updatedAt))
    .limit(page.perPage)
    .offset((page.page - 1) * page.perPage);
  const [total] = await database.select({ value: count() }).from(customersTable).where(where);
  return { rows, total: total?.value ?? 0 };
}

/**
 * Orders and money spent per customer, net of refunds, leaving out cancelled orders. Orders
 * from before the move (archived by the Shopify import) count too, so the customer's history
 * doesn't start again at nothing.
 */
export async function sumCustomerOrders(
  database: DatabaseOrTransaction,
  customerIds: readonly string[],
): Promise<Map<string, CustomerTotals>> {
  const totals = new Map<string, CustomerTotals>();
  if (customerIds.length === 0) return totals;
  const ids = [...customerIds];
  const live = await database
    .select({
      customerId: ordersTable.customerId,
      currency: ordersTable.currency,
      orderCount: count(),
      amount: sql<number>`coalesce(sum(${ordersTable.totalAmount} - ${ordersTable.refundedAmount}), 0)`,
    })
    .from(ordersTable)
    .where(and(inArray(ordersTable.customerId, ids), isNull(ordersTable.cancelledAt)))
    .groupBy(ordersTable.customerId, ordersTable.currency);
  // Cancelled orders from before the move don't count or add up, but still date the customer.
  const notCancelled = sql`${archivedOrdersTable.cancelledAt} is null`;
  const archived = await database
    .select({
      customerId: archivedOrdersTable.customerId,
      currency: archivedOrdersTable.currency,
      orderCount: sql<number>`cast(count(*) filter (where ${notCancelled}) as integer)`,
      amount: sql<number>`coalesce(sum(${archivedOrdersTable.totalAmount} - ${archivedOrdersTable.refundedAmount}) filter (where ${notCancelled}), 0)`,
      firstAt: min(archivedOrdersTable.placedAt),
    })
    .from(archivedOrdersTable)
    .where(inArray(archivedOrdersTable.customerId, ids))
    .groupBy(archivedOrdersTable.customerId, archivedOrdersTable.currency);
  const add = (
    row: { customerId: string | null; currency: string; orderCount: number; amount: number },
    firstAt: Date | null,
  ) => {
    if (!row.customerId) return;
    const current = totals.get(row.customerId) ?? {
      orderCount: 0,
      totalSpent: [],
      firstArchivedOrderAt: null,
    };
    current.orderCount += Number(row.orderCount);
    const spent = current.totalSpent.find((each) => each.currency === row.currency);
    if (spent) spent.amount += Number(row.amount);
    else if (Number(row.orderCount) > 0) {
      current.totalSpent.push({ currency: row.currency, amount: Number(row.amount) });
    }
    if (firstAt && (!current.firstArchivedOrderAt || firstAt < current.firstArchivedOrderAt)) {
      current.firstArchivedOrderAt = firstAt;
    }
    totals.set(row.customerId, current);
  };
  live.forEach((row) => add(row, null));
  archived.forEach((row) => add(row, row.firstAt ? new Date(row.firstAt) : null));
  return totals;
}
