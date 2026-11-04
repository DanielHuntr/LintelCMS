import { and, count, eq, gte, isNull, type SQL, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../database/client.js";
import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import { ordersTable as ordersDefinition } from "../orders/orders.table.js";
import { tableFor } from "../../database/dialect/mysql-tables.js";
import { utcDay } from "../../database/dialect/expressions.js";

/** Database reads for the sales summary. Cancelled and test orders don't count; refunds come off. */

function netSales(ordersTable: typeof ordersDefinition) {
  return sql<number>`coalesce(sum(${ordersTable.totalAmount} - ${ordersTable.refundedAmount}), 0)`;
}

function ordersSince(ordersTable: typeof ordersDefinition, since: Date): SQL | undefined {
  return and(
    eq(ordersTable.tenantId, DEFAULT_TENANT_ID),
    gte(ordersTable.createdAt, since),
    isNull(ordersTable.cancelledAt),
    eq(ordersTable.isTest, false),
  );
}

export async function sumSalesByCurrency(database: DatabaseOrTransaction, since: Date) {
  const ordersTable = tableFor(database, ordersDefinition);
  const rows = await database
    .select({ currency: ordersTable.currency, amount: netSales(ordersTable), orderCount: count() })
    .from(ordersTable)
    .where(ordersSince(ordersTable, since))
    .groupBy(ordersTable.currency);
  return rows.map((row) => ({ ...row, amount: Number(row.amount) }));
}

/** One row per UTC day that had orders in the currency. */
export async function sumDailySales(
  database: DatabaseOrTransaction,
  since: Date,
  currency: string,
) {
  const ordersTable = tableFor(database, ordersDefinition);
  const day = utcDay(database, ordersTable.createdAt);
  const rows = await database
    .select({ date: day, amount: netSales(ordersTable), orderCount: count() })
    .from(ordersTable)
    .where(and(ordersSince(ordersTable, since), eq(ordersTable.currency, currency)))
    .groupBy(day)
    .orderBy(day);
  return rows.map((row) => ({ ...row, amount: Number(row.amount) }));
}
