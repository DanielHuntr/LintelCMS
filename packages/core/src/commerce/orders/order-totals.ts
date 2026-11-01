import type { DatabaseOrTransaction } from "../../database/client.js";
import { fulfilmentStatusFor, paymentStatusFor } from "./order-statuses.js";
import { listOrderLineRows, updateOrderRow } from "./orders.repository.js";
import type { OrderLineRow, OrderRow } from "./orders.table.js";
import { sumRefunds } from "./refunds-and-fulfilments.repository.js";

/**
 * Brings an order's refunded amount and statuses up to date with its refunds and lines.
 * Called after anything that changes them, so the numbers are never edited by hand.
 */
export async function refreshOrderTotals(
  database: DatabaseOrTransaction,
  order: OrderRow,
): Promise<void> {
  const refunds = await sumRefunds(database, order.id);
  const lines = await listOrderLineRows(database, order.id);
  await updateOrderRow(database, order.id, {
    refundedAmount: refunds.succeeded,
    paymentStatus: paymentStatusFor(order.totalAmount, refunds.succeeded),
    fulfilmentStatus: fulfilmentStatusFor(lines),
  });
}

/** What can still be refunded: the total less refunds made and on their way. */
export async function refundableAmount(
  database: DatabaseOrTransaction,
  order: OrderRow,
): Promise<number> {
  const refunds = await sumRefunds(database, order.id);
  return Math.max(0, order.totalAmount - refunds.succeeded - refunds.pending);
}

/**
 * A line's share of what the customer paid, for `quantity` of it: its price after
 * discounts, plus its tax when tax was added on top.
 */
export function paidForLine(line: OrderLineRow, quantity: number, taxesIncluded: boolean): number {
  const paid = line.subtotalAmount - line.discountAmount + (taxesIncluded ? 0 : line.taxAmount);
  return Math.round((paid * quantity) / line.quantity);
}
