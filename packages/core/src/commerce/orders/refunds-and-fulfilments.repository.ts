import { and, asc, eq } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../database/client.js";
import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import type { MarketPaymentProviderId } from "../payments/payment-provider.js";
import {
  type FulfilmentRow,
  fulfilmentsTable as fulfilmentsDefinition,
  ordersTable as ordersDefinition,
  type RefundRow,
  refundsTable as refundsDefinition,
  type RefundStatus,
} from "./orders.table.js";
import { insertReturning } from "../../database/dialect/writes.js";
import { sumWhere } from "../../database/dialect/expressions.js";
import { tableFor } from "../../database/dialect/mysql-tables.js";

/** Database reads and writes for refunds and fulfilments. */

export async function insertRefund(
  database: DatabaseOrTransaction,
  refund: Omit<typeof refundsDefinition.$inferInsert, "tenantId">,
): Promise<RefundRow> {
  const refundsTable = tableFor(database, refundsDefinition);
  const [inserted] = await insertReturning(database, refundsTable, {
    tenantId: DEFAULT_TENANT_ID,
    ...refund,
  });
  if (!inserted) throw new Error("Saving the refund returned nothing");
  return inserted;
}

export async function findRefundRow(
  database: DatabaseOrTransaction,
  refundId: string,
): Promise<RefundRow | undefined> {
  const refundsTable = tableFor(database, refundsDefinition);
  const [row] = await database
    .select()
    .from(refundsTable)
    .where(eq(refundsTable.id, refundId))
    .limit(1);
  return row;
}

export async function findRefundRowByStripeId(
  database: DatabaseOrTransaction,
  stripeRefundId: string,
): Promise<RefundRow | undefined> {
  const refundsTable = tableFor(database, refundsDefinition);
  const [row] = await database
    .select()
    .from(refundsTable)
    .where(eq(refundsTable.stripeRefundId, stripeRefundId))
    .limit(1);
  return row;
}

export async function findRefundRowByProviderId(
  database: DatabaseOrTransaction,
  providerRefundId: string,
): Promise<RefundRow | undefined> {
  const refundsTable = tableFor(database, refundsDefinition);
  const [row] = await database
    .select()
    .from(refundsTable)
    .where(eq(refundsTable.providerRefundId, providerRefundId))
    .limit(1);
  return row;
}

export async function updateRefundRow(
  database: DatabaseOrTransaction,
  refundId: string,
  changes: { status?: RefundStatus; stripeRefundId?: string; providerRefundId?: string },
): Promise<void> {
  const refundsTable = tableFor(database, refundsDefinition);
  await database.update(refundsTable).set(changes).where(eq(refundsTable.id, refundId));
}

export async function listRefundRows(
  database: DatabaseOrTransaction,
  orderId: string,
): Promise<RefundRow[]> {
  const refundsTable = tableFor(database, refundsDefinition);
  return database
    .select()
    .from(refundsTable)
    .where(eq(refundsTable.orderId, orderId))
    .orderBy(asc(refundsTable.createdAt));
}

/** Refunded so far, and what's on its way (pending), for the "how much is left" check. */
export async function sumRefunds(
  database: DatabaseOrTransaction,
  orderId: string,
): Promise<{ succeeded: number; pending: number }> {
  const refundsTable = tableFor(database, refundsDefinition);
  const [row] = await database
    .select({
      succeeded: sumWhere(database, refundsTable.amount, eq(refundsTable.status, "succeeded")),
      pending: sumWhere(database, refundsTable.amount, eq(refundsTable.status, "pending")),
    })
    .from(refundsTable)
    .where(eq(refundsTable.orderId, orderId));
  return { succeeded: Number(row?.succeeded ?? 0), pending: Number(row?.pending ?? 0) };
}

export async function insertFulfilment(
  database: DatabaseOrTransaction,
  fulfilment: Omit<typeof fulfilmentsDefinition.$inferInsert, "tenantId">,
): Promise<FulfilmentRow> {
  const fulfilmentsTable = tableFor(database, fulfilmentsDefinition);
  const [inserted] = await insertReturning(database, fulfilmentsTable, {
    tenantId: DEFAULT_TENANT_ID,
    ...fulfilment,
  });
  if (!inserted) throw new Error("Saving the fulfilment returned nothing");
  return inserted;
}

export async function listFulfilmentRows(
  database: DatabaseOrTransaction,
  orderId: string,
): Promise<FulfilmentRow[]> {
  const fulfilmentsTable = tableFor(database, fulfilmentsDefinition);
  return database
    .select()
    .from(fulfilmentsTable)
    .where(
      and(eq(fulfilmentsTable.tenantId, DEFAULT_TENANT_ID), eq(fulfilmentsTable.orderId, orderId)),
    )
    .orderBy(asc(fulfilmentsTable.createdAt));
}

/** Orders with a refund the provider hasn't settled yet, with those refunds' ids. */
export async function listOrdersWithPendingRefunds(
  database: DatabaseOrTransaction,
  provider: MarketPaymentProviderId,
): Promise<Array<{ providerPaymentId: string | null; providerRefundId: string | null }>> {
  const ordersTable = tableFor(database, ordersDefinition);
  const refundsTable = tableFor(database, refundsDefinition);
  return database
    .select({
      providerPaymentId: ordersTable.providerPaymentId,
      providerRefundId: refundsTable.providerRefundId,
    })
    .from(refundsTable)
    .innerJoin(ordersTable, eq(refundsTable.orderId, ordersTable.id))
    .where(and(eq(refundsTable.status, "pending"), eq(ordersTable.paymentProvider, provider)));
}
