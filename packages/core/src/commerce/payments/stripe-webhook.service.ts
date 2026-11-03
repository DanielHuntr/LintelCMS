import type { Transaction } from "../../database/client.js";
import type { CheckoutRow } from "../checkouts/checkouts.table.js";
import { HttpError } from "../../http/http-errors.js";
import { abandonCheckout } from "../checkouts/checkout-expiry.js";
import type { ShopContext } from "../commerce.context.js";
import { ShopNotReadyError } from "../commerce.errors.js";
import { placeOrderForPayment } from "../orders/order-placement.service.js";
import { announceIfRefunded, recordStripeRefund } from "../orders/refunds.service.js";
import { type AfterCommit, followUpPlacement, runAfterCommit } from "./payment-follow-up.js";
import {
  retrieveStripeCheckoutSession,
  retrieveStripePaymentIntent,
  stripeRefundSchema,
} from "./stripe-api.js";
import { recordStripeEventIfNew } from "./stripe-events.repository.js";
import { verifyStripeSignature } from "./stripe-signature.js";
import {
  type StripeEvent,
  stripeCheckoutSessionObjectSchema,
  stripeEventSchema,
  stripePaymentIntentObjectSchema,
} from "./stripe-webhook-events.js";
import type { z } from "zod";
import { fromStripeAmount } from "../money/stripe-amounts.js";

/**
 * Stripe's webhook, the normal way an order becomes paid. Every request must carry a valid
 * `Stripe-Signature` made with the endpoint's signing secret, so a forged "paid" message is
 * refused. Each event is handled once (see stripe-events.table.ts), and anything that talks
 * to the outside world (emails, recording tax with Stripe) happens after the transaction
 * has committed.
 *
 * Two other routes reach the same work with what Stripe itself answers to the shop's secret
 * key, which needs no signature: `applyStripeEvent` for events Lintel reads from Stripe when
 * no webhook can reach the shop, and `confirmStripeCheckout` when a shopper comes back.
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
  return applyStripeEvent(shop, parsed.data);
}

/** Handles an event once, however it arrived: a repeat is acknowledged and ignored. */
export async function applyStripeEvent(
  shop: ShopContext,
  event: StripeEvent,
): Promise<{ received: true; duplicate: boolean }> {
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

/**
 * Fetches a checkout's payment back from Stripe and, if it was paid, places the order. There
 * is no event id here: placing the order under the checkout's lock is what makes this safe
 * against a webhook arriving before, during or after.
 */
export async function confirmStripeCheckout(
  shop: ShopContext,
  checkout: CheckoutRow,
): Promise<void> {
  const stripe = await shop.stripe();
  const afterCommit: AfterCommit[] = [];
  if (checkout.stripeCheckoutSessionId) {
    const session = await retrieveStripeCheckoutSession(stripe, checkout.stripeCheckoutSessionId);
    await shop.database.transaction((transaction) =>
      placeForSession(shop, transaction, session, afterCommit),
    );
  } else if (checkout.stripePaymentIntentId) {
    const intent = await retrieveStripePaymentIntent(stripe, checkout.stripePaymentIntentId);
    if (intent.status !== "succeeded") return;
    await shop.database.transaction((transaction) =>
      placeForIntent(shop, transaction, intent, afterCommit),
    );
  }
  await runAfterCommit(shop, afterCommit, `the Stripe payment for checkout ${checkout.id}`);
}

async function placeForSession(
  shop: ShopContext,
  transaction: Transaction,
  session: z.infer<typeof stripeCheckoutSessionObjectSchema>,
  afterCommit: AfterCommit[],
): Promise<void> {
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
}

async function placeForIntent(
  shop: ShopContext,
  transaction: Transaction,
  intent: z.infer<typeof stripePaymentIntentObjectSchema>,
  afterCommit: AfterCommit[],
): Promise<void> {
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
      await placeForSession(shop, transaction, session, afterCommit);
      return;
    }
    case "payment_intent.succeeded": {
      const intent = stripePaymentIntentObjectSchema.parse(object);
      await placeForIntent(shop, transaction, intent, afterCommit);
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
