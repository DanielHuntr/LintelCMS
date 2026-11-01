import { and, count, eq, gte, isNull, type SQL, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../database/client.js";
import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import { ordersTable } from "../orders/orders.table.js";

/** Database reads for the sales summary. Cancelled orders don't count; refunds come off. */

const netSales = sql<number>`coalesce(sum(${ordersTable.totalAmount} - ${ordersTable.refundedAmount}), 0)`;

function ordersSince(since: Date): SQL | undefined {
  return and(
    eq(ordersTable.tenantId, DEFAULT_TENANT_ID),
    gte(ordersTable.createdAt, since),
    isNull(ordersTable.cancelledAt),
  );
}

export async function sumSalesByCurrency(database: DatabaseOrTransaction, since: Date) {
  const rows = await database
    .select({ currency: ordersTable.currency, amount: netSales, orderCount: count() })
    .from(ordersTable)
    .where(ordersSince(since))
    .groupBy(ordersTable.currency);
  return rows.map((row) => ({ ...row, amount: Number(row.amount) }));
}

/** One row per UTC day that had orders in the currency. */
export async function sumDailySales(
  database: DatabaseOrTransaction,
  since: Date,
  currency: string,
) {
  const day = sql<string>`to_char(${ordersTable.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`;
  const rows = await database
    .select({ date: day, amount: netSales, orderCount: count() })
    .from(ordersTable)
    .where(and(ordersSince(since), eq(ordersTable.currency, currency)))
    .groupBy(day)
    .orderBy(day);
  return rows.map((row) => ({ ...row, amount: Number(row.amount) }));
}
