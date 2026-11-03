import { DEFAULT_TENANT_ID } from "../../../database/columns.js";
import type { CheckoutRow } from "../../checkouts/checkouts.table.js";
import { listOrdersWithPendingRefunds } from "../../orders/refunds-and-fulfilments.repository.js";
import { HttpError } from "../../../http/http-errors.js";
import { abandonCheckout } from "../../checkouts/checkout-expiry.js";
import { findCheckoutRow } from "../../checkouts/checkouts.repository.js";
import type { ShopContext } from "../../commerce.context.js";
import { PaymentProviderError, ShopNotReadyError } from "../../commerce.errors.js";
import { placeOrderForPayment } from "../../orders/order-placement.service.js";
import { announceIfRefunded, settleProviderRefund } from "../../orders/refunds.service.js";
import { recordPaymentEventIfNew } from "../payment-accounts.repository.js";
import { type AfterCommit, followUpPlacement, runAfterCommit } from "../payment-follow-up.js";
import { ProviderRequestError } from "../payment-provider.js";
import { fromDecimalAmount } from "../provider-amounts.js";
import {
  capturePayPalOrder,
  type PayPalTransmission,
  payPalCaptureResourceSchema,
  payPalEventSchema,
  payPalOrderResourceSchema,
  payPalRefundResourceSchema,
  payPalRefundStatus,
  retrievePayPalOrder,
  retrievePayPalRefund,
  verifyPayPalWebhook,
} from "./paypal-api.js";
import { connectPayPal } from "./paypal-provider.js";

export const PAYPAL_WEBHOOK_PATH = "/shop/paypal/webhook";

export class InvalidPayPalSignatureError extends HttpError {
  constructor() {
    super(400, "INVALID_SIGNATURE", "PayPal didn't confirm that this request came from PayPal.");
  }
}

/**
 * PayPal's webhook. Nothing in a request is believed until PayPal itself has confirmed,
 * through its verify-webhook-signature API, that it sent it to this shop's webhook. Then:
 *
 *   CHECKOUT.ORDER.APPROVED     the shopper approved: take the money (only while the
 *                               checkout is open, so a late approval is never charged)
 *   PAYMENT.CAPTURE.COMPLETED   the money arrived: the order is placed (once)
 *   PAYMENT.CAPTURE.DENIED      the payment failed: the stock goes back on sale
 *   PAYMENT.CAPTURE.REFUNDED    a refund went through
 *
 * Each event is handled once (shop_payment_events), in the same transaction as its work.
 */
export async function handlePayPalWebhook(
  shop: ShopContext,
  body: unknown,
  transmission: Partial<PayPalTransmission>,
): Promise<{ received: true; duplicate: boolean }> {
  const { client, credentials } = await connectPayPal(shop);
  if (!credentials.webhookId) {
    throw new ShopNotReadyError(
      "The PayPal webhook id isn't set yet, so PayPal's messages can't be checked.",
    );
  }
  const parsed = payPalEventSchema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(400, "INVALID_REQUEST", "The webhook body isn't a PayPal event.");
  }
  const event = parsed.data;
  const complete = readTransmission(transmission);
  if (
    !complete ||
    !(await verify(() => verifyPayPalWebhook(client, complete, credentials.webhookId ?? "", body)))
  ) {
    throw new InvalidPayPalSignatureError();
  }

  if (event.event_type === "CHECKOUT.ORDER.APPROVED") {
    // Not recorded: capturing is safe to repeat, and a failure answers 502 so PayPal retries.
    const order = payPalOrderResourceSchema.parse(event.resource);
    const checkoutId = order.purchase_units[0]?.custom_id;
    const checkout = checkoutId
      ? await findCheckoutRow(shop.database, DEFAULT_TENANT_ID, checkoutId)
      : undefined;
    if (checkout?.status === "open" && checkout.providerPaymentId === order.id) {
      await verify(() => capturePayPalOrder(client, order.id));
    }
    return { received: true, duplicate: false };
  }

  const afterCommit: AfterCommit[] = [];
  const isNew = await shop.database.transaction(async (transaction) => {
    if (
      !(await recordPaymentEventIfNew(transaction, {
        provider: "paypal",
        eventId: event.id,
        type: event.event_type,
      }))
    ) {
      return false;
    }
    switch (event.event_type) {
      case "PAYMENT.CAPTURE.COMPLETED": {
        const capture = payPalCaptureResourceSchema.parse(event.resource);
        if (!capture.custom_id) return true;
        const currency = capture.amount.currency_code.toUpperCase();
        const result = await placeOrderForPayment(
          transaction,
          capture.custom_id,
          {
            provider: "paypal",
            paymentIntentId: null,
            providerPaymentId: capture.id,
            amount: fromDecimalAmount(capture.amount.value, currency) ?? -1,
            currency,
          },
          shop.now(),
        );
        followUpPlacement(shop, result, afterCommit);
        return true;
      }
      case "PAYMENT.CAPTURE.DENIED": {
        const capture = payPalCaptureResourceSchema.parse(event.resource);
        if (capture.custom_id) await abandonCheckout(transaction, capture.custom_id);
        return true;
      }
      case "PAYMENT.CAPTURE.REFUNDED": {
        const refund = payPalRefundResourceSchema.parse(event.resource);
        const outcome = await settleProviderRefund(
          transaction,
          refund.id,
          payPalRefundStatus(refund.status),
        );
        afterCommit.push(() => announceIfRefunded(shop, outcome));
        return true;
      }
      default:
        return true;
    }
  });
  await runAfterCommit(shop, afterCommit, `PayPal event ${event.id}`);
  return { received: true, duplicate: !isNew };
}

/**
 * What the webhook does, for a shop it can't reach or when the shopper comes back: fetches
 * the order from PayPal with the shop's own credentials, takes the money if the shopper
 * approved (only while the checkout is open, as the webhook does), and places the order once
 * the capture is complete. The checkout's lock makes it safe against the webhook.
 */
export async function confirmPayPalCheckout(
  shop: ShopContext,
  checkout: CheckoutRow,
): Promise<void> {
  const orderId = checkout.providerPaymentId;
  if (!orderId) return;
  const { client } = await connectPayPal(shop);
  let order = await retrievePayPalOrder(client, orderId);
  if (order.status === "APPROVED" && checkout.status === "open") {
    await capturePayPalOrder(client, orderId);
    order = await retrievePayPalOrder(client, orderId);
  }
  const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
  if (!capture) return;

  const afterCommit: AfterCommit[] = [];
  await shop.database.transaction(async (transaction) => {
    if (capture.status === "COMPLETED") {
      const currency = (capture.amount?.currency_code ?? "").toUpperCase();
      const result = await placeOrderForPayment(
        transaction,
        checkout.id,
        {
          provider: "paypal",
          paymentIntentId: null,
          providerPaymentId: capture.id,
          amount: capture.amount ? (fromDecimalAmount(capture.amount.value, currency) ?? -1) : -1,
          currency,
        },
        shop.now(),
      );
      followUpPlacement(shop, result, afterCommit);
    } else if (capture.status === "DECLINED" || capture.status === "FAILED") {
      await abandonCheckout(transaction, checkout.id);
    }
  });
  await runAfterCommit(shop, afterCommit, `PayPal order ${orderId}`);
}

/** Brings refunds PayPal hadn't finished up to date, as its webhook would. */
export async function settlePendingPayPalRefunds(shop: ShopContext): Promise<void> {
  const pending = await listOrdersWithPendingRefunds(shop.database, "paypal");
  if (pending.length === 0) return;
  const { client } = await connectPayPal(shop);
  for (const { providerRefundId } of pending) {
    if (!providerRefundId) continue;
    const refund = await retrievePayPalRefund(client, providerRefundId);
    const outcome = await shop.database.transaction((transaction) =>
      settleProviderRefund(transaction, refund.id, payPalRefundStatus(refund.status)),
    );
    await announceIfRefunded(shop, outcome);
  }
}

function readTransmission(headers: Partial<PayPalTransmission>): PayPalTransmission | null {
  const { authAlgo, certUrl, transmissionId, transmissionSig, transmissionTime } = headers;
  if (!authAlgo || !certUrl || !transmissionId || !transmissionSig || !transmissionTime) {
    return null;
  }
  return { authAlgo, certUrl, transmissionId, transmissionSig, transmissionTime };
}

async function verify<Result>(call: () => Promise<Result>): Promise<Result> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof ProviderRequestError) {
      throw new PaymentProviderError(
        `PayPal couldn't be asked about this webhook: ${error.message}`,
      );
    }
    throw error;
  }
}
