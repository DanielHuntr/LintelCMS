import type { Transaction } from "../../database/client.js";
import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import { describeLine } from "../checkouts/line-names.js";
import { lockCheckoutRow, updateCheckoutRow } from "../checkouts/checkouts.repository.js";
import type { CheckoutRow } from "../checkouts/checkouts.table.js";
import { recordCustomerForOrder } from "../customers/customers.service.js";
import { markRedemptionsUsed } from "../discounts/discounts.repository.js";
import { takeStockForOrder } from "../inventory/inventory.service.js";
import { formatMoney } from "../money/money-format.js";
import { PAYMENT_PROVIDER_NAMES, type PaymentProviderId } from "../payments/payment-provider.js";
import { takeNextOrderNumber } from "../settings/shop-settings.repository.js";
import {
  findOrderRow,
  insertOrder,
  insertOrderEvent,
  insertOrderLines,
} from "./orders.repository.js";
import type { OrderRow } from "./orders.table.js";

/**
 * Turning a paid checkout into an order. Called only once the payment provider has
 * confirmed the payment in a way that can't be forged (Stripe's signed webhook, a PayPal
 * webhook PayPal verified, or a payment or event fetched back from the provider with the
 * shop's own key), inside the transaction that records it: an order never exists without a
 * confirmed payment. The test checkout comes here too, from a signed test session, and its
 * orders are marked as test. The checkout's lock makes every route safe to repeat or race.
 */

export interface ConfirmedPayment {
  /** Defaults to Stripe. */
  provider?: PaymentProviderId;
  /** Stripe's payment intent, for Stripe payments. */
  paymentIntentId: string | null;
  /** PayPal's capture id or Mollie's payment id, which refunds go against. */
  providerPaymentId?: string | null;
  /**
   * The provider says this wasn't live: Stripe's test mode, a Mollie test payment, PayPal's
   * sandbox. Only ever set on the provider's clear word, so a real sale is never hidden.
   */
  isTest?: boolean;
  /** What the provider says was paid, in minor units, and in which currency (any case). */
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
  // A test payment can only pay a test checkout, and nothing else can pay one.
  if ((payment.provider === "test") !== (checkout.paymentProvider === "test")) {
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
    const problem = `${PAYMENT_PROVIDER_NAMES[payment.provider ?? "stripe"]} reported ${formatMoney({ amount: payment.amount, currency: payment.currency.toUpperCase() })} paid, but the checkout came to ${formatMoney({ amount: checkout.totalAmount, currency: checkout.currency })}.`;
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
    paymentProvider: payment.provider ?? "stripe",
    providerPaymentId: payment.providerPaymentId ?? null,
    stripePaymentIntentId: payment.paymentIntentId ?? checkout.stripePaymentIntentId,
    isTest: checkout.paymentProvider === "test" || payment.isTest === true,
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
  await markRedemptionsUsed(transaction, checkout.id, order.id);

  await insertOrderEvent(transaction, {
    orderId: order.id,
    kind: "placed",
    message: `Order placed by ${checkout.email}`,
  });
  await insertOrderEvent(transaction, {
    orderId: order.id,
    kind: "paid",
    message: `Payment of ${formatMoney({ amount: payment.amount, currency: checkout.currency })} received through ${PAYMENT_PROVIDER_NAMES[order.paymentProvider]}`,
    data: {
      paymentIntentId: order.stripePaymentIntentId,
      providerPaymentId: order.providerPaymentId,
    },
  });
  if (order.isTest) {
    await insertOrderEvent(transaction, {
      orderId: order.id,
      kind: "test_order",
      message:
        "This is a test order. No money was taken, and it doesn't count as a sale. Automations don't run for it.",
    });
  }
  for (const discount of checkout.discounts) {
    const name = discount.code ? `Code ${discount.code}` : discount.title;
    await insertOrderEvent(transaction, {
      orderId: order.id,
      kind: "discount",
      message: discount.freeShipping
        ? `${name} made delivery free (saving ${formatMoney({ amount: discount.amount, currency: checkout.currency })})`
        : `${name} took ${formatMoney({ amount: discount.amount, currency: checkout.currency })} off`,
      data: { discountId: discount.discountId ?? null, code: discount.code },
    });
  }
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
