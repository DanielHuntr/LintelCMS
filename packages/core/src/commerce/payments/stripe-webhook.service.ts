import type { Transaction } from "../../database/client.js";
import { HttpError } from "../../http/http-errors.js";
import { abandonCheckout } from "../checkouts/checkout-expiry.js";
import type { ShopContext } from "../commerce.context.js";
import { ShopNotReadyError } from "../commerce.errors.js";
import { placeOrderForPayment } from "../orders/order-placement.service.js";
import { announceIfRefunded, recordStripeRefund } from "../orders/refunds.service.js";
import { type AfterCommit, followUpPlacement, runAfterCommit } from "./payment-follow-up.js";
import { stripeRefundSchema } from "./stripe-api.js";
import { recordStripeEventIfNew } from "./stripe-events.repository.js";
import { verifyStripeSignature } from "./stripe-signature.js";
import {
  type StripeEvent,
  stripeCheckoutSessionObjectSchema,
  stripeEventSchema,
  stripePaymentIntentObjectSchema,
} from "./stripe-webhook-events.js";
import { fromStripeAmount } from "../money/stripe-amounts.js";

/**
 * Stripe's webhook: the only way an order becomes paid. Every request must carry a valid
 * `Stripe-Signature` made with the endpoint's signing secret, so a forged "paid" message is
 * refused. Each event is handled once (see stripe-events.table.ts), and anything that talks
 * to the outside world (emails, recording tax with Stripe) happens after the transaction
 * has committed.
 */

export class InvalidStripeSignatureError extends HttpError {
  constructor() {
    super(
      400,
      "INVALID_SIGNATURE",
      "This request isn't signed by Stripe with this shop's signing secret.",
    );
  }
}

export async function handleStripeWebhook(
  shop: ShopContext,
  rawBody: string,
  signature: string | undefined,
): Promise<{ received: true; duplicate: boolean }> {
  const keys = await shop.stripeKeys();
  if (!keys.webhookSecret) {
    throw new ShopNotReadyError(
      "The Stripe signing secret isn't set yet, so webhooks can't be checked.",
    );
  }
  if (
    !signature ||
    !verifyStripeSignature(rawBody, signature, keys.webhookSecret.value, shop.now())
  ) {
    throw new InvalidStripeSignatureError();
  }
  const parsed = stripeEventSchema.safeParse(safeJson(rawBody));
  if (!parsed.success) {
    throw new HttpError(400, "INVALID_REQUEST", "The webhook body isn't a Stripe event.");
  }
  const event = parsed.data;

  const afterCommit: AfterCommit[] = [];
  const isNew = await shop.database.transaction(async (transaction) => {
    if (!(await recordStripeEventIfNew(transaction, event))) {
      return false;
    }
    await handleEvent(shop, transaction, event, afterCommit);
    return true;
  });

  await runAfterCommit(shop, afterCommit, `Stripe event ${event.id}`);
  return { received: true, duplicate: !isNew };
}

async function handleEvent(
  shop: ShopContext,
  transaction: Transaction,
  event: StripeEvent,
  afterCommit: AfterCommit[],
): Promise<void> {
  const object = event.data.object;
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = stripeCheckoutSessionObjectSchema.parse(object);
      const checkoutId = session.metadata?.lintel_checkout_id ?? session.client_reference_id;
      if (session.payment_status !== "paid" || !checkoutId) return;
      const result = await placeOrderForPayment(
        transaction,
        checkoutId,
        {
          paymentIntentId: session.payment_intent ?? null,
          amount:
            session.amount_total == null
              ? -1
              : fromStripeAmount(session.amount_total, session.currency ?? ""),
          currency: session.currency ?? "",
        },
        shop.now(),
      );
      followUpPlacement(shop, result, afterCommit);
      return;
    }
    case "payment_intent.succeeded": {
      const intent = stripePaymentIntentObjectSchema.parse(object);
      const checkoutId = intent.metadata?.lintel_checkout_id;
      if (!checkoutId) return;
      const result = await placeOrderForPayment(
        transaction,
        checkoutId,
        {
          paymentIntentId: intent.id,
          amount:
            intent.amount_received == null
              ? -1
              : fromStripeAmount(intent.amount_received, intent.currency ?? ""),
          currency: intent.currency ?? "",
        },
        shop.now(),
      );
      followUpPlacement(shop, result, afterCommit);
      return;
    }
    case "checkout.session.expired": {
      const session = stripeCheckoutSessionObjectSchema.parse(object);
      const checkoutId = session.metadata?.lintel_checkout_id ?? session.client_reference_id;
      if (checkoutId) await abandonCheckout(transaction, checkoutId);
      return;
    }
    case "payment_intent.canceled": {
      const intent = stripePaymentIntentObjectSchema.parse(object);
      const checkoutId = intent.metadata?.lintel_checkout_id;
      if (checkoutId) await abandonCheckout(transaction, checkoutId);
      return;
    }
    case "refund.created":
    case "refund.updated": {
      const outcome = await recordStripeRefund(transaction, stripeRefundSchema.parse(object));
      afterCommit.push(() => announceIfRefunded(shop, outcome));
      return;
    }
    default:
      // Events the shop doesn't need are acknowledged, so Stripe stops sending them.
      return;
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
