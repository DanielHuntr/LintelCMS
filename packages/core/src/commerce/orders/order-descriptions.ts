import { displayStatusFor, unfulfilledQuantity } from "./order-statuses.js";
import type { Order, OrderSummary } from "./orders.schema.js";
import type {
  FulfilmentRow,
  OrderEventRow,
  OrderLineRow,
  OrderRow,
  RefundRow,
} from "./orders.table.js";

/** Orders as the admin sees them. */

export function describeOrderSummary(row: OrderRow, itemCount: number): OrderSummary {
  return {
    id: row.id,
    number: row.number,
    name: row.name,
    email: row.email,
    customerName: row.shippingAddress.name,
    status: displayStatusFor(row),
    paymentStatus: row.paymentStatus,
    fulfilmentStatus: row.fulfilmentStatus,
    cancelled: row.cancelledAt !== null,
    total: { amount: row.totalAmount, currency: row.currency },
    itemCount,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface OrderParts {
  lines: readonly OrderLineRow[];
  refunds: readonly RefundRow[];
  fulfilments: readonly FulfilmentRow[];
  events: readonly OrderEventRow[];
  refundable: number;
  stripeMode: "test" | "live" | null;
}

export function describeOrder(row: OrderRow, parts: OrderParts): Order {
  const money = (amount: number) => ({ amount, currency: row.currency });
  const itemCount = parts.lines.reduce((sum, line) => sum + line.quantity, 0);
  return {
    ...describeOrderSummary(row, itemCount),
    customerId: row.customerId,
    shippingAddress: row.shippingAddress,
    shippingLine: { name: row.shippingLine.name, amount: money(row.shippingLine.amount) },
    subtotal: money(row.subtotalAmount),
    discount: money(row.discountAmount),
    discounts: row.discounts.map((discount) => ({
      code: discount.code,
      title: discount.title,
      amount: money(discount.amount),
      freeShipping: discount.freeShipping ?? false,
    })),
    shipping: money(row.shippingAmount),
    tax: money(row.taxAmount),
    refunded: money(row.refundedAmount),
    taxesIncluded: row.taxesIncluded,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    cancelReason: row.cancelReason,
    refundable: money(parts.refundable),
    lines: parts.lines.map((line) => ({
      id: line.id,
      productId: line.productId,
      variantId: line.variantId,
      productTitle: line.productTitle,
      variantTitle: line.variantTitle,
      sku: line.sku,
      imageId: line.imageId,
      quantity: line.quantity,
      unitPrice: money(line.unitAmount),
      subtotal: money(line.subtotalAmount),
      discount: money(line.discountAmount),
      tax: money(line.taxAmount),
      fulfilledQuantity: line.fulfilledQuantity,
      refundedQuantity: line.refundedQuantity,
      unfulfilledQuantity: unfulfilledQuantity(line),
    })),
    refunds: parts.refunds.map((refund) => ({
      id: refund.id,
      amount: money(refund.amount),
      status: refund.status,
      reason: refund.reason,
      createdAt: refund.createdAt.toISOString(),
    })),
    fulfilments: parts.fulfilments.map((fulfilment) => ({
      id: fulfilment.id,
      lines: fulfilment.lines,
      trackingCompany: fulfilment.trackingCompany,
      trackingNumber: fulfilment.trackingNumber,
      trackingUrl: fulfilment.trackingUrl,
      createdAt: fulfilment.createdAt.toISOString(),
    })),
    timeline: parts.events.map((event) => ({
      id: event.id,
      kind: event.kind,
      message: event.message,
      createdAt: event.createdAt.toISOString(),
    })),
    paymentProvider: row.paymentProvider,
    stripePaymentUrl:
      row.stripePaymentIntentId && parts.stripeMode
        ? `https://dashboard.stripe.com/${parts.stripeMode === "test" ? "test/" : ""}payments/${row.stripePaymentIntentId}`
        : null,
  };
}
