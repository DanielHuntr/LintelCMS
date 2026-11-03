import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import type { ShopContext } from "../commerce.context.js";
import { PaymentProviderError } from "../commerce.errors.js";
import { listMarketRows } from "../markets/markets.repository.js";
import { listMollieMethods } from "./mollie/mollie-api.js";
import {
  findMollieCredentials,
  mollieClientFor,
  mollieWebhookUrl,
} from "./mollie/mollie-provider.js";
import { deleteCredentials, saveCredentials } from "./payment-accounts.repository.js";
import { ProviderRequestError } from "./payment-provider.js";
import { marketPaymentProvider } from "./payment-provider.js";
import type {
  ConnectMollieRequest,
  ConnectPayPalRequest,
  PaymentProviders,
} from "./payment-providers.schema.js";
import { PAYPAL_WEBHOOK_EVENTS, retrievePayPalWebhook } from "./paypal/paypal-api.js";
import { findPayPalCredentials, payPalClientFor } from "./paypal/paypal-provider.js";
import { PAYPAL_WEBHOOK_PATH } from "./paypal/paypal-webhook.service.js";
import { isLocalAddress, needsOwnChecks } from "./local-address.js";
import { hintForSecret, mollieKeyMode } from "./provider-credentials.js";

/**
 * Connecting PayPal and Mollie from Shop → Settings → Payments, as Stripe is connected:
 * keys are tried against the provider before they're saved, so a typo shows up now rather
 * than when the first shopper tries to pay. Stripe's own steps are in payment-settings.service.ts.
 */

export async function readPaymentProviders(shop: ShopContext): Promise<PaymentProviders> {
  const paypal = await findPayPalCredentials(shop);
  const mollie = await findMollieCredentials(shop);
  const markets = await listMarketRows(shop.database, DEFAULT_TENANT_ID);
  return {
    paypal: {
      // On someone's own computer PayPal can't send a webhook, and Lintel asks PayPal instead.
      connected:
        paypal !== null && (paypal.webhookId !== null || isLocalAddress(shop.publicApiUrl)),
      checksForPayments:
        paypal !== null && needsOwnChecks(shop.publicApiUrl, paypal.webhookId !== null),
      mode: paypal ? (paypal.environment === "live" ? "live" : "test") : null,
      source: paypal?.source ?? null,
      clientIdHint: paypal ? hintForSecret(paypal.clientId) : null,
      webhookIdSet: paypal?.webhookId != null,
      webhookUrl: `${shop.publicApiUrl.replace(/\/+$/, "")}${PAYPAL_WEBHOOK_PATH}`,
      webhookEvents: [...PAYPAL_WEBHOOK_EVENTS],
    },
    mollie: {
      connected: mollie !== null,
      mode: mollie ? mollieKeyMode(mollie.apiKey) : null,
      source: mollie?.source ?? null,
      apiKeyHint: mollie ? hintForSecret(mollie.apiKey) : null,
      checksForPayments: mollie !== null && mollieWebhookUrl(shop.publicApiUrl) === null,
      webhookUrl: mollieWebhookUrl(shop.publicApiUrl),
    },
    markets: markets.map((market) => ({
      id: market.id,
      name: market.name,
      currency: market.currency,
      paymentProvider: marketPaymentProvider(market),
    })),
  };
}

export async function savePayPalConnection(
  shop: ShopContext,
  request: ConnectPayPalRequest,
): Promise<PaymentProviders> {
  const client = payPalClientFor(shop, request);
  await tryProvider(
    "PayPal",
    () => client.accessToken(),
    (status) =>
      status === 401
        ? "PayPal didn't accept that Client ID and secret. Check both are from the same app, and that sandbox or live matches where you copied them."
        : null,
  );
  if (request.webhookId) {
    const webhookId = request.webhookId;
    await tryProvider(
      "PayPal",
      () => retrievePayPalWebhook(client, webhookId),
      (status) =>
        status === 404
          ? "PayPal doesn't know that webhook ID for this app. Copy it from the app's Webhooks section."
          : null,
    );
  }
  await saveCredentials(shop.database, "paypal", request);
  return readPaymentProviders(shop);
}

export async function saveMollieConnection(
  shop: ShopContext,
  request: ConnectMollieRequest,
): Promise<PaymentProviders> {
  await tryProvider(
    "Mollie",
    () => listMollieMethods(mollieClientFor(shop, request.apiKey)),
    (status) =>
      status === 401 ? "Mollie didn't accept that API key. Check you copied all of it." : null,
  );
  await saveCredentials(shop.database, "mollie", request);
  return readPaymentProviders(shop);
}

/** Forgets the keys saved in the admin. Keys in the environment stay. */
export async function disconnectProvider(
  shop: ShopContext,
  provider: "paypal" | "mollie",
): Promise<PaymentProviders> {
  await deleteCredentials(shop.database, provider);
  return readPaymentProviders(shop);
}

async function tryProvider(
  name: string,
  call: () => Promise<unknown>,
  explainStatus: (status: number) => string | null,
): Promise<void> {
  try {
    await call();
  } catch (error) {
    if (error instanceof ProviderRequestError) {
      throw new PaymentProviderError(
        explainStatus(error.status) ?? `${name} couldn't check the keys: ${error.message}`,
      );
    }
    throw error;
  }
}
