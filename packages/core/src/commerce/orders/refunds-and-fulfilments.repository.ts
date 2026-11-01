import { and, asc, eq, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../database/client.js";
import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import {
  type FulfilmentRow,
  fulfilmentsTable,
  type RefundRow,
  refundsTable,
  type RefundStatus,
} from "./orders.table.js";

/** Database reads and writes for refunds and fulfilments. */

export async function insertRefund(
  database: DatabaseOrTransaction,
  refund: Omit<typeof refundsTable.$inferInsert, "tenantId">,
): Promise<RefundRow> {
  const [inserted] = await database
    .insert(refundsTable)
    .values({ tenantId: DEFAULT_TENANT_ID, ...refund })
    .returning();
  if (!inserted) throw new Error("Saving the refund returned nothing");
  return inserted;
}

export async function findRefundRow(
  database: DatabaseOrTransaction,
  refundId: string,
): Promise<RefundRow | undefined> {
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
  await database.update(refundsTable).set(changes).where(eq(refundsTable.id, refundId));
}

export async function listRefundRows(
  database: DatabaseOrTransaction,
  orderId: string,
): Promise<RefundRow[]> {
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
  const [row] = await database
    .select({
      succeeded: sql<number>`coalesce(sum(${refundsTable.amount}) filter (where ${refundsTable.status} = 'succeeded'), 0)`,
      pending: sql<number>`coalesce(sum(${refundsTable.amount}) filter (where ${refundsTable.status} = 'pending'), 0)`,
    })
    .from(refundsTable)
    .where(eq(refundsTable.orderId, orderId));
  return { succeeded: Number(row?.succeeded ?? 0), pending: Number(row?.pending ?? 0) };
}

export async function insertFulfilment(
  database: DatabaseOrTransaction,
  fulfilment: Omit<typeof fulfilmentsTable.$inferInsert, "tenantId">,
): Promise<FulfilmentRow> {
  const [inserted] = await database
    .insert(fulfilmentsTable)
    .values({ tenantId: DEFAULT_TENANT_ID, ...fulfilment })
    .returning();
  if (!inserted) throw new Error("Saving the fulfilment returned nothing");
  return inserted;
}

export async function listFulfilmentRows(
  database: DatabaseOrTransaction,
  orderId: string,
): Promise<FulfilmentRow[]> {
  return database
    .select()
    .from(fulfilmentsTable)
    .where(
      and(eq(fulfilmentsTable.tenantId, DEFAULT_TENANT_ID), eq(fulfilmentsTable.orderId, orderId)),
    )
    .orderBy(asc(fulfilmentsTable.createdAt));
}
