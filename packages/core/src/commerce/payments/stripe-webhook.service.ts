import type { Transaction } from "../../database/client.js";
import { HttpError } from "../../http/http-errors.js";
import { abandonCheckout } from "../checkouts/checkout-expiry.js";
import type { ShopContext } from "../commerce.context.js";
import { ShopNotReadyError } from "../commerce.errors.js";
import { sendOrderConfirmation } from "../emails/order-notifications.js";
import { insertOrderEvent } from "../orders/orders.repository.js";
import { placeOrderForPayment, type PlacementResult } from "../orders/order-placement.service.js";
import { notifyIfRefunded, recordStripeRefund } from "../orders/refunds.service.js";
import { createStripeTaxTransaction, stripeRefundSchema } from "./stripe-api.js";
import { recordStripeEventIfNew } from "./stripe-events.repository.js";
import { verifyStripeSignature } from "./stripe-signature.js";
import {
  type StripeEvent,
  stripeCheckoutSessionObjectSchema,
  stripeEventSchema,
  stripePaymentIntentObjectSchema,
} from "./stripe-webhook-events.js";

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

type AfterCommit = () => Promise<void>;

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

  for (const action of afterCommit) {
    try {
      await action();
    } catch (error) {
      shop.log.error(error, `Following up Stripe event ${event.id} failed`);
    }
  }
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
          amount: session.amount_total ?? -1,
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
          amount: intent.amount_received ?? -1,
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
      afterCommit.push(() => notifyIfRefunded(shop, outcome));
      return;
    }
    default:
      // Events the shop doesn't need are acknowledged, so Stripe stops sending them.
      return;
  }
}

function followUpPlacement(
  shop: ShopContext,
  result: PlacementResult,
  afterCommit: AfterCommit[],
): void {
  if (result.outcome === "needs_review") {
    shop.log.warn(`Checkout ${result.checkout.id} needs review: ${result.checkout.problem ?? ""}`);
    return;
  }
  if (result.outcome !== "placed") return;
  const { order, checkout } = result;
  afterCommit.push(() => sendOrderConfirmation(shop, order.id));
  if (checkout.taxCalculation === "stripe" && checkout.taxReference) {
    const calculationId = checkout.taxReference;
    afterCommit.push(async () => {
      try {
        await createStripeTaxTransaction(await shop.stripe(), calculationId, order.id);
      } catch (error) {
        shop.log.error(error, `Recording the tax for order ${order.name} with Stripe failed`);
        await insertOrderEvent(shop.database, {
          orderId: order.id,
          kind: "tax_not_recorded",
          message:
            "The tax on this order couldn't be recorded with Stripe Tax. Add it to your tax report by hand.",
        });
      }
    });
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
