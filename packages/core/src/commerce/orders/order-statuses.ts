import type { FulfilmentStatus, OrderLineRow, OrderRow, PaymentStatus } from "./orders.table.js";

/**
 * An order's statuses follow from its numbers, so they're always worked out the same way
 * rather than set by hand:
 *
 *   payment:    paid → partially refunded → refunded        (by the amount refunded)
 *   fulfilment: unfulfilled → partially fulfilled → fulfilled (by the items sent)
 *
 * Items that were refunded don't need sending, so an order whose unsent items were all
 * refunded counts as fulfilled.
 */
export function paymentStatusFor(totalAmount: number, refundedAmount: number): PaymentStatus {
  if (refundedAmount <= 0) return "paid";
  return refundedAmount >= totalAmount ? "refunded" : "partially_refunded";
}

export function fulfilmentStatusFor(lines: readonly OrderLineRow[]): FulfilmentStatus {
  const toSend = lines.reduce((sum, line) => sum + line.quantity - line.refundedQuantity, 0);
  const sent = lines.reduce((sum, line) => sum + line.fulfilledQuantity, 0);
  if (sent === 0) return "unfulfilled";
  return sent >= toSend ? "fulfilled" : "partially_fulfilled";
}

/** How many of a line can still be sent. */
export function unfulfilledQuantity(line: OrderLineRow): number {
  return Math.max(0, line.quantity - line.fulfilledQuantity - line.refundedQuantity);
}

export const orderDisplayStatuses = [
  "paid",
  "partially_refunded",
  "refunded",
  "partially_fulfilled",
  "fulfilled",
  "cancelled",
] as const;

export type OrderDisplayStatus = (typeof orderDisplayStatuses)[number];

/** The one word the admin's order list leads with. Cancelled and refunds come first. */
export function displayStatusFor(
  order: Pick<OrderRow, "cancelledAt" | "paymentStatus" | "fulfilmentStatus">,
): OrderDisplayStatus {
  if (order.cancelledAt) return "cancelled";
  if (order.paymentStatus !== "paid") return order.paymentStatus;
  if (order.fulfilmentStatus !== "unfulfilled") return order.fulfilmentStatus;
  return "paid";
}
