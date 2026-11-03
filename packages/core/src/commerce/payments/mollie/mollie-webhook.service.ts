import { HttpError } from "../../../http/http-errors.js";
import { abandonCheckout } from "../../checkouts/checkout-expiry.js";
import type { ShopContext } from "../../commerce.context.js";
import { PaymentProviderError } from "../../commerce.errors.js";
import { placeOrderForPayment } from "../../orders/order-placement.service.js";
import { announceIfRefunded, settleProviderRefund } from "../../orders/refunds.service.js";
import { type AfterCommit, followUpPlacement, runAfterCommit } from "../payment-follow-up.js";
import { ProviderRequestError } from "../payment-provider.js";
import { fromDecimalAmount } from "../provider-amounts.js";
import {
  listMollieRefunds,
  type MolliePayment,
  mollieRefundStatus,
  retrieveMolliePayment,
} from "./mollie-api.js";
import { connectMollie } from "./mollie-provider.js";

const PAYMENT_ID_PATTERN = /^tr_[A-Za-z0-9]+$/;

/**
 * Mollie's webhook. Mollie sends only a payment id and no signature, so nothing in the
 * request is believed: the payment is fetched back from Mollie with the shop's own API key,
 * and what Mollie answers is what happens.
 *
 *   paid                        the order is placed (once), and any refunds are brought up to date
 *   expired, canceled, failed   the checkout's stock goes back on sale
 *
 * An unknown id is acknowledged without saying anything, so the endpoint can't be used to
 * find out which payments exist.
 */
export async function handleMollieWebhook(
  shop: ShopContext,
  paymentId: string | undefined,
): Promise<{ received: true }> {
  if (!paymentId || !PAYMENT_ID_PATTERN.test(paymentId)) {
    throw new HttpError(400, "INVALID_REQUEST", "Mollie's webhook sends the payment's id.");
  }
  const { client } = await connectMollie(shop);
  let payment: MolliePayment;
  try {
    payment = await retrieveMolliePayment(client, paymentId);
  } catch (error) {
    if (error instanceof ProviderRequestError && error.status === 404) return { received: true };
    if (error instanceof ProviderRequestError) {
      // Answering with an error makes Mollie try again later.
      throw new PaymentProviderError(
        `Mollie couldn't be asked about payment ${paymentId}: ${error.message}`,
      );
    }
    throw error;
  }
  const checkoutId = payment.metadata?.lintel_checkout_id;
  if (typeof checkoutId !== "string") return { received: true };

  const refunds = payment.status === "paid" ? await listMollieRefunds(client, payment.id) : [];
  const afterCommit: AfterCommit[] = [];
  await shop.database.transaction(async (transaction) => {
    if (payment.status === "paid") {
      const currency = payment.amount.currency.toUpperCase();
      const result = await placeOrderForPayment(
        transaction,
        checkoutId,
        {
          provider: "mollie",
          isTest: payment.mode === "test",
          paymentIntentId: null,
          providerPaymentId: payment.id,
          amount: fromDecimalAmount(payment.amount.value, currency) ?? -1,
          currency,
        },
        shop.now(),
      );
      followUpPlacement(shop, result, afterCommit);
      for (const refund of refunds) {
        const outcome = await settleProviderRefund(
          transaction,
          refund.id,
          mollieRefundStatus(refund.status),
        );
        afterCommit.push(() => announceIfRefunded(shop, outcome));
      }
    } else if (["expired", "canceled", "failed"].includes(payment.status)) {
      await abandonCheckout(transaction, checkoutId);
    }
  });
  await runAfterCommit(shop, afterCommit, `Mollie payment ${payment.id}`);
  return { received: true };
}
