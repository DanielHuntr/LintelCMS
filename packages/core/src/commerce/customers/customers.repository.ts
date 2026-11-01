import { and, count, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../database/client.js";
import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import { ordersTable } from "../orders/orders.table.js";
import { type CustomerRow, customersTable } from "./customers.table.js";

/** Database reads and writes for customers. */

export interface CustomerWithTotals extends CustomerRow {
  orderCount: number;
  /** By currency, since a customer may have bought in more than one market. */
  totalSpent: Array<{ currency: string; amount: number }>;
}

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

/** Orders and money spent per customer, net of refunds, leaving out cancelled orders. */
export async function sumCustomerOrders(
  database: DatabaseOrTransaction,
  customerIds: readonly string[],
): Promise<Map<string, Pick<CustomerWithTotals, "orderCount" | "totalSpent">>> {
  const totals = new Map<string, Pick<CustomerWithTotals, "orderCount" | "totalSpent">>();
  if (customerIds.length === 0) return totals;
  const rows = await database
    .select({
      customerId: ordersTable.customerId,
      currency: ordersTable.currency,
      orderCount: count(),
      amount: sql<number>`coalesce(sum(${ordersTable.totalAmount} - ${ordersTable.refundedAmount}), 0)`,
    })
    .from(ordersTable)
    .where(and(inArray(ordersTable.customerId, [...customerIds]), isNull(ordersTable.cancelledAt)))
    .groupBy(ordersTable.customerId, ordersTable.currency);
  for (const row of rows) {
    if (!row.customerId) continue;
    const current = totals.get(row.customerId) ?? { orderCount: 0, totalSpent: [] };
    current.orderCount += row.orderCount;
    current.totalSpent.push({ currency: row.currency, amount: Number(row.amount) });
    totals.set(row.customerId, current);
  }
  return totals;
}
