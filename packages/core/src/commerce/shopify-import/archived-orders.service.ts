import type { DatabaseOrTransaction } from "../../database/client.js";
import { listArchivedOrderRows } from "./shopify-import.repository.js";
import type { ArchivedOrder } from "./shopify-import.schema.js";
import type { ArchivedOrderRow } from "./shopify-import.table.js";

/** Orders from before the move, to look up: by customer, newest first. */
export async function listArchivedOrders(
  database: DatabaseOrTransaction,
  query: { customerId?: string; page: number; perPage: number },
): Promise<{ items: ArchivedOrder[]; total: number }> {
  const { rows, total } = await listArchivedOrderRows(
    database,
    { customerId: query.customerId },
    query,
  );
  return { items: rows.map(describeArchivedOrder), total };
}

function describeArchivedOrder(row: ArchivedOrderRow): ArchivedOrder {
  const money = (amount: number) => ({ amount, currency: row.currency });
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    customerId: row.customerId,
    total: money(row.totalAmount),
    refunded: money(row.refundedAmount),
    paymentStatus: row.paymentStatus,
    fulfilmentStatus: row.fulfilmentStatus,
    discountCodes: row.discountCodes,
    itemCount: row.lines.reduce((sum, line) => sum + line.quantity, 0),
    lines: row.lines,
    placedAt: row.placedAt.toISOString(),
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
  };
}
