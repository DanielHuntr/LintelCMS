import type { ShopContext } from "../../commerce.context.js";
import { ShopNotReadyError } from "../../commerce.errors.js";
import { findSavedCredentials } from "../payment-accounts.repository.js";
import type { SavedMollieCredentials } from "../payment-accounts.table.js";
import type { PaymentProvider } from "../payment-provider.js";
import { type MollieCredentials, resolveMollieCredentials } from "../provider-credentials.js";
import {
  cancelMolliePayment,
  createMolliePayment,
  createMollieRefund,
  mollieRefundStatus,
  retrieveMolliePayment,
} from "./mollie-api.js";
import { MollieClient } from "./mollie-client.js";

export const MOLLIE_WEBHOOK_PATH = "/shop/mollie/webhook";

/**
 * Mollie behind the PaymentProvider interface: the shopper pays on Mollie's hosted page
 * (cards, iDEAL, Bancontact and the rest), and the webhook fetches the payment back from
 * Mollie before believing anything (see mollie-webhook.service.ts).
 */
export function molliePaymentProvider(shop: ShopContext): PaymentProvider {
  return {
    id: "mollie",
    checkReady: async () => {
      await connectMollie(shop);
    },
    needsPages: async () => true,
    async startPayment(checkout, pages) {
      if (!pages) throw new Error("Mollie always needs pages to send the shopper back to");
      const { client } = await connectMollie(shop);
      const payment = await createMolliePayment(client, checkout, pages, {
        webhookUrl: mollieWebhookUrl(shop.publicApiUrl),
        description: `Order from ${checkout.email}`,
      });
      return {
        url: payment.checkoutUrl,
        clientSecret: null,
        saved: { providerPaymentId: payment.id },
      };
    },
    async closePayment(checkout) {
      if (!checkout.providerPaymentId) return;
      const { client } = await connectMollie(shop);
      // A bank transfer takes days, far longer than the checkout's window, and the shopper
      // may already have sent it. Left open, it's honoured when it arrives.
      const payment = await retrieveMolliePayment(client, checkout.providerPaymentId);
      if (payment.method === "banktransfer") return;
      await cancelMolliePayment(client, checkout.providerPaymentId);
    },
    async refundPayment(order, refund) {
      if (!order.providerPaymentId) throw new Error("A paid Mollie order always has its payment");
      const { client } = await connectMollie(shop);
      const made = await createMollieRefund(client, {
        paymentId: order.providerPaymentId,
        amount: refund.amount,
        currency: order.currency,
        refundId: refund.id,
      });
      return { reference: made.id, status: mollieRefundStatus(made.status) };
    },
  };
}

/**
 * Mollie can't reach a server on localhost, and refuses payments that name such a webhook,
 * so while developing locally the webhook is left out and payments are checked by hand.
 */
export function mollieWebhookUrl(publicApiUrl: string): string | null {
  const host = new URL(publicApiUrl).hostname;
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")) return null;
  return `${publicApiUrl.replace(/\/+$/, "")}${MOLLIE_WEBHOOK_PATH}`;
}

export async function findMollieCredentials(shop: ShopContext): Promise<MollieCredentials | null> {
  const saved = await findSavedCredentials(shop.database, "mollie");
  return resolveMollieCredentials(saved as SavedMollieCredentials | null, shop.environment);
}

export function mollieClientFor(shop: ShopContext, apiKey: string): MollieClient {
  return new MollieClient({ apiKey, fetch: shop.paymentFetch, apiUrl: shop.mollieApiUrl });
}

export async function connectMollie(
  shop: ShopContext,
): Promise<{ client: MollieClient; credentials: MollieCredentials }> {
  const credentials = await findMollieCredentials(shop);
  if (!credentials) {
    throw new ShopNotReadyError(
      "Mollie isn't connected yet. Connect it in Shop → Settings → Payments first.",
    );
  }
  return { client: mollieClientFor(shop, credentials.apiKey), credentials };
}
