import type { Transaction } from "../../database/client.js";
import type { ShopContext } from "../commerce.context.js";
import { PaymentProviderError, ShopRecordNotFoundError } from "../commerce.errors.js";
import { sendOrderRefunded } from "../emails/order-notifications.js";
import { restock } from "../inventory/inventory.service.js";
import { formatMoney } from "../money/money-format.js";
import {
  PAYMENT_PROVIDER_NAMES,
  type ProviderRefund,
  ProviderRequestError,
} from "../payments/payment-provider.js";
import { paymentProviderFor } from "../payments/payment-providers.js";
import type { StripeRefund } from "../payments/stripe-api.js";
import { stripeRefundStatus } from "../payments/stripe-provider.js";
import { InvalidOrderLinesError, RefundTooLargeError } from "./orders.errors.js";
import {
  findOrderRow,
  findOrderRowByPaymentIntent,
  insertOrderEvent,
  listOrderLineRows,
  lockOrderRow,
  updateOrderLineRow,
} from "./orders.repository.js";
import type { RefundOrderRequest } from "./orders.schema.js";
import type { LineQuantity, RefundRow, RefundStatus } from "./orders.table.js";
import { paidForLine, refreshOrderTotals, refundableAmount } from "./order-totals.js";
import {
  findRefundRow,
  findRefundRowByProviderId,
  findRefundRowByStripeId,
  insertRefund,
  updateRefundRow,
} from "./refunds-and-fulfilments.repository.js";

/**
 * Giving money back, always through the provider that took it (Stripe, PayPal or Mollie).
 * A refund is saved as `pending` before the provider is asked, so two clicks can't refund
 * twice (the second sees the first counted against what's left), and the provider's own
 * idempotency key makes a retried request safe as well.
 *
 * A line's refund is what was paid for it: its price after its share of any discount, plus
 * its tax when tax was added on top (order-totals.ts).
 */

export interface RefundOutcome {
  refund: RefundRow;
  /** Moved to succeeded just now: time to tell the customer. */
  justSucceeded: boolean;
}

export async function refundOrder(
  shop: ShopContext,
  orderId: string,
  request: RefundOrderRequest,
  createdBy: string | null,
): Promise<RefundRow> {
  const pending = await shop.database.transaction((transaction) =>
    savePendingRefund(transaction, orderId, request, createdBy),
  );
  const order = await findOrderRow(shop.database, orderId);
  if (!order) {
    throw new ShopRecordNotFoundError("order");
  }

  let made: ProviderRefund;
  try {
    made = await paymentProviderFor(shop, order.paymentProvider).refundPayment(order, pending);
  } catch (error) {
    await shop.database.transaction((transaction) =>
      changeRefundStatus(transaction, pending, "failed"),
    );
    if (error instanceof ProviderRequestError) {
      throw new PaymentProviderError(
        `${PAYMENT_PROVIDER_NAMES[order.paymentProvider]} couldn't make the refund: ${error.message}`,
      );
    }
    throw error;
  }

  const outcome = await shop.database.transaction(async (transaction) => {
    await updateRefundRow(
      transaction,
      pending.id,
      order.paymentProvider === "stripe"
        ? { stripeRefundId: made.reference }
        : { providerRefundId: made.reference },
    );
    const current = (await findRefundRow(transaction, pending.id)) ?? pending;
    return changeRefundStatus(transaction, current, made.status);
  });
  await notifyIfRefunded(shop, outcome);
  return outcome.refund;
}

/**
 * A refund Stripe told us about by webhook: one of ours finishing, or one made in Stripe's
 * dashboard, which is recorded so the order's numbers stay true.
 */
export async function recordStripeRefund(
  transaction: Transaction,
  stripeRefund: StripeRefund,
): Promise<RefundOutcome | null> {
  const ourId = stripeRefund.metadata?.lintel_refund_id;
  let refund =
    (await findRefundRowByStripeId(transaction, stripeRefund.id)) ??
    (ourId && /^[0-9a-f-]{36}$/.test(ourId) ? await findRefundRow(transaction, ourId) : undefined);

  if (!refund) {
    const order = stripeRefund.payment_intent
      ? await findOrderRowByPaymentIntent(transaction, stripeRefund.payment_intent)
      : undefined;
    if (!order) return null;
    refund = await insertRefund(transaction, {
      orderId: order.id,
      amount: stripeRefund.amount,
      currency: order.currency,
      reason: "Refunded in Stripe",
      stripeRefundId: stripeRefund.id,
      notifyCustomer: false,
    });
  } else if (!refund.stripeRefundId) {
    await updateRefundRow(transaction, refund.id, { stripeRefundId: stripeRefund.id });
  }
  return changeRefundStatus(transaction, refund, stripeRefundStatus(stripeRefund.status));
}

export async function notifyIfRefunded(
  shop: ShopContext,
  outcome: RefundOutcome | null,
): Promise<void> {
  if (outcome?.justSucceeded && outcome.refund.notifyCustomer) {
    await sendOrderRefunded(shop, outcome.refund.orderId, outcome.refund);
  }
}

async function savePendingRefund(
  transaction: Transaction,
  orderId: string,
  request: RefundOrderRequest,
  createdBy: string | null,
): Promise<RefundRow> {
  const order = await lockOrderRow(transaction, orderId);
  if (!order) {
    throw new ShopRecordNotFoundError("order");
  }
  const lines = await listOrderLineRows(transaction, orderId);
  const chosen = checkRefundLines(request.lines, lines);
  const amount =
    request.amount ??
    chosen.reduce(
      (sum, { line, quantity }) => sum + paidForLine(line, quantity, order.taxesIncluded),
      0,
    );
  const refundable = await refundableAmount(transaction, order);
  if (amount > refundable || amount <= 0) {
    throw new RefundTooLargeError(
      refundable === 0 ? "nothing" : formatMoney({ amount: refundable, currency: order.currency }),
    );
  }
  for (const { line, quantity } of chosen) {
    await updateOrderLineRow(transaction, line.id, {
      refundedQuantity: line.refundedQuantity + quantity,
    });
  }
  return insertRefund(transaction, {
    orderId,
    amount,
    currency: order.currency,
    reason: request.reason,
    lines: request.lines,
    restock: request.restock,
    notifyCustomer: request.notifyCustomer,
    createdBy,
  });
}

function checkRefundLines(
  requested: readonly LineQuantity[],
  lines: Awaited<ReturnType<typeof listOrderLineRows>>,
) {
  return requested.map((item) => {
    const line = lines.find((candidate) => candidate.id === item.orderLineId);
    if (!line) {
      throw new InvalidOrderLinesError("One of the items isn't part of this order.");
    }
    if (item.quantity > line.quantity - line.refundedQuantity) {
      throw new InvalidOrderLinesError(
        `Only ${line.quantity - line.refundedQuantity} of ${line.productTitle} can still be refunded.`,
      );
    }
    return { line, quantity: item.quantity };
  });
}

/** A PayPal or Mollie refund that has settled since it was made. */
export async function settleProviderRefund(
  transaction: Transaction,
  providerRefundId: string,
  status: RefundStatus,
): Promise<RefundOutcome | null> {
  const refund = await findRefundRowByProviderId(transaction, providerRefundId);
  return refund ? changeRefundStatus(transaction, refund, status) : null;
}

/**
 * Moves a refund on, doing what each move means exactly once:
 *   pending → succeeded   restock if asked, update the order's numbers, note it
 *   pending → failed      give the items back to the order, note it
 */
async function changeRefundStatus(
  transaction: Transaction,
  refund: RefundRow,
  status: RefundStatus,
): Promise<RefundOutcome> {
  if (refund.status === status || refund.status !== "pending") {
    return { refund, justSucceeded: false };
  }
  await updateRefundRow(transaction, refund.id, { status });
  const order = await lockOrderRow(transaction, refund.orderId);
  if (!order) return { refund: { ...refund, status }, justSucceeded: false };
  const amount = formatMoney({ amount: refund.amount, currency: refund.currency });

  if (status === "succeeded") {
    if (refund.restock) {
      const lines = await listOrderLineRows(transaction, order.id);
      await restock(
        transaction,
        refund.lines.flatMap((item) => {
          const variantId = lines.find((line) => line.id === item.orderLineId)?.variantId;
          return variantId ? [{ variantId, quantity: item.quantity }] : [];
        }),
      );
    }
    await insertOrderEvent(transaction, {
      orderId: order.id,
      kind: "refunded",
      message: `Refunded ${amount}${refund.reason ? `: ${refund.reason}` : ""}`,
      data: { refundId: refund.id },
      createdBy: refund.createdBy,
    });
  } else if (status === "failed") {
    const lines = await listOrderLineRows(transaction, order.id);
    for (const item of refund.lines) {
      const line = lines.find((candidate) => candidate.id === item.orderLineId);
      if (line) {
        await updateOrderLineRow(transaction, line.id, {
          refundedQuantity: Math.max(0, line.refundedQuantity - item.quantity),
        });
      }
    }
    await insertOrderEvent(transaction, {
      orderId: order.id,
      kind: "refund_failed",
      message: `A refund of ${amount} didn't go through`,
      data: { refundId: refund.id },
    });
  }
  await refreshOrderTotals(transaction, order);
  return { refund: { ...refund, status }, justSucceeded: status === "succeeded" };
}
