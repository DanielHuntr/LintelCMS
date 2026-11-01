import type { Transaction } from "../../database/client.js";
import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import { describeLine } from "../checkouts/line-names.js";
import { lockCheckoutRow, updateCheckoutRow } from "../checkouts/checkouts.repository.js";
import type { CheckoutRow } from "../checkouts/checkouts.table.js";
import { recordCustomerForOrder } from "../customers/customers.service.js";
import { takeStockForOrder } from "../inventory/inventory.service.js";
import { formatMoney } from "../money/money-format.js";
import { takeNextOrderNumber } from "../settings/shop-settings.repository.js";
import {
  findOrderRow,
  insertOrder,
  insertOrderEvent,
  insertOrderLines,
} from "./orders.repository.js";
import type { OrderRow } from "./orders.table.js";

/**
 * Turning a paid checkout into an order. Called only from the Stripe webhook, after its
 * signature has been checked, inside the transaction that records the event: an order
 * never exists without a payment Stripe has confirmed.
 */

export interface ConfirmedPayment {
  paymentIntentId: string | null;
  /** What Stripe says was paid, in minor units, and in which currency (lowercase from Stripe). */
  amount: number;
  currency: string;
}

export type PlacementResult =
  | { outcome: "placed"; order: OrderRow; checkout: CheckoutRow }
  | { outcome: "already_placed"; order: OrderRow }
  | { outcome: "needs_review"; checkout: CheckoutRow }
  | { outcome: "unknown_checkout" };

export async function placeOrderForPayment(
  transaction: Transaction,
  checkoutId: string,
  payment: ConfirmedPayment,
  paidAt: Date,
): Promise<PlacementResult> {
  const checkout = await lockCheckoutRow(transaction, DEFAULT_TENANT_ID, checkoutId);
  if (!checkout) {
    return { outcome: "unknown_checkout" };
  }
  if (checkout.orderId) {
    const order = await findOrderRow(transaction, checkout.orderId);
    if (order) return { outcome: "already_placed", order };
  }
  if (
    payment.amount !== checkout.totalAmount ||
    payment.currency.toUpperCase() !== checkout.currency
  ) {
    // Never guess: a payment that doesn't match the checkout is left for a person to look at.
    const problem = `Stripe reported ${formatMoney({ amount: payment.amount, currency: payment.currency.toUpperCase() })} paid, but the checkout came to ${formatMoney({ amount: checkout.totalAmount, currency: checkout.currency })}.`;
    await updateCheckoutRow(transaction, checkout.id, { status: "needs_review", problem });
    return { outcome: "needs_review", checkout: { ...checkout, status: "needs_review", problem } };
  }

  const customer = await recordCustomerForOrder(
    transaction,
    checkout.email,
    checkout.shippingAddress,
  );
  const { number, prefix } = await takeNextOrderNumber(transaction, DEFAULT_TENANT_ID);
  const order = await insertOrder(transaction, {
    tenantId: DEFAULT_TENANT_ID,
    number,
    name: `${prefix}${number}`,
    checkoutId: checkout.id,
    customerId: customer.id,
    email: checkout.email,
    marketId: checkout.marketId,
    currency: checkout.currency,
    shippingAddress: checkout.shippingAddress,
    shippingLine: checkout.shippingLine,
    discounts: checkout.discounts,
    subtotalAmount: checkout.subtotalAmount,
    discountAmount: checkout.discountAmount,
    shippingAmount: checkout.shippingAmount,
    taxAmount: checkout.taxAmount,
    totalAmount: checkout.totalAmount,
    taxesIncluded: checkout.taxesIncluded,
    stripePaymentIntentId: payment.paymentIntentId ?? checkout.stripePaymentIntentId,
    paidAt,
  });
  await insertOrderLines(
    transaction,
    checkout.lines.map((line, position) => ({
      tenantId: DEFAULT_TENANT_ID,
      orderId: order.id,
      variantId: line.variantId,
      productId: line.productId || null,
      productTitle: line.productTitle,
      variantTitle: line.variantTitle,
      sku: line.sku,
      imageId: line.imageId,
      quantity: line.quantity,
      unitAmount: line.unitAmount,
      subtotalAmount: line.subtotalAmount,
      discountAmount: line.discountAmount,
      taxAmount: line.taxAmount,
      weightGrams: line.weightGrams,
      position,
    })),
  );

  const oversold = await takeStockForOrder(
    transaction,
    checkout.id,
    checkout.lines.map((line) => ({
      variantId: line.variantId,
      quantity: line.quantity,
      title: describeLine(line.productTitle, line.variantTitle),
    })),
  );
  await updateCheckoutRow(transaction, checkout.id, { status: "completed", orderId: order.id });

  await insertOrderEvent(transaction, {
    orderId: order.id,
    kind: "placed",
    message: `Order placed by ${checkout.email}`,
  });
  await insertOrderEvent(transaction, {
    orderId: order.id,
    kind: "paid",
    message: `Payment of ${formatMoney({ amount: payment.amount, currency: checkout.currency })} received through Stripe`,
    data: { paymentIntentId: order.stripePaymentIntentId },
  });
  if (oversold.length > 0) {
    const titles = checkout.lines
      .filter((line) => oversold.includes(line.variantId))
      .map((line) => describeLine(line.productTitle, line.variantTitle));
    await insertOrderEvent(transaction, {
      orderId: order.id,
      kind: "oversold",
      message: `The payment arrived after the stock was released, so there may not be enough of: ${titles.join(", ")}. Check before sending.`,
      data: { variantIds: oversold },
    });
  }
  return { outcome: "placed", order, checkout };
}
