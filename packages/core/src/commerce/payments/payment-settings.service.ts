import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import type { ShopContext } from "../commerce.context.js";
import { PaymentProviderError } from "../commerce.errors.js";
import { updateShopSettingsRow } from "../settings/shop-settings.repository.js";
import { readShopSettingsRow } from "../settings/shop-settings.service.js";
import { isLocalAddress, needsOwnChecks } from "./local-address.js";
import type { PaymentSettings, UpdatePaymentSettingsRequest } from "./payment-settings.schema.js";
import { retrieveStripeAccount } from "./stripe-api.js";
import { StripeRequestError } from "./stripe-client.js";
import { stripeKeyMode } from "./stripe-keys.js";
import { STRIPE_WEBHOOK_EVENTS } from "./stripe-webhook-events.js";

/** Connecting Stripe: saving the keys from the admin's guided steps, and checking them. */

export const STRIPE_WEBHOOK_PATH = "/shop/stripe/webhook";

export async function readPaymentSettings(shop: ShopContext): Promise<PaymentSettings> {
  const settings = await readShopSettingsRow(shop.database);
  const keys = await shop.stripeKeys();
  const secret = keys.secretKey;
  const siteIsLocal = isLocalAddress(shop.publicApiUrl);
  return {
    // On someone's own computer Stripe can't send a webhook, and Lintel asks Stripe instead.
    connected: secret !== null && (keys.webhookSecret !== null || siteIsLocal),
    siteIsLocal,
    checksForPayments:
      secret !== null && needsOwnChecks(shop.publicApiUrl, keys.webhookSecret !== null),
    mode: secret ? stripeKeyMode(secret.value) : null,
    secretKey: secret ? { hint: hintFor(secret.value), source: secret.source } : null,
    publishableKey: keys.publishableKey,
    webhookSecret: keys.webhookSecret ? { source: keys.webhookSecret.source } : null,
    lastWebhookAt: settings.stripeLastWebhookAt?.toISOString() ?? null,
    webhookUrl: `${shop.publicApiUrl.replace(/\/+$/, "")}${STRIPE_WEBHOOK_PATH}`,
    webhookEvents: [...STRIPE_WEBHOOK_EVENTS],
    checkoutMode: settings.checkoutMode,
  };
}

/**
 * Saves the keys given. A new secret key is tried against Stripe first, so a typo is caught
 * now rather than when the first customer tries to pay.
 */
export async function updatePaymentSettings(
  shop: ShopContext,
  changes: UpdatePaymentSettingsRequest,
): Promise<PaymentSettings> {
  if (changes.secretKey) {
    await checkSecretKey(shop, changes.secretKey);
  }
  if (changes.secretKey && changes.publishableKey) {
    if (stripeKeyMode(changes.secretKey) !== modeOfPublishable(changes.publishableKey)) {
      throw new PaymentProviderError(
        "One key is a test key and the other is a live key. Copy both from the same place in Stripe.",
      );
    }
  }
  await updateShopSettingsRow(shop.database, DEFAULT_TENANT_ID, {
    ...(changes.secretKey && { stripeSecretKey: changes.secretKey }),
    ...(changes.publishableKey && { stripePublishableKey: changes.publishableKey }),
    ...(changes.webhookSecret && {
      stripeWebhookSecret: changes.webhookSecret,
      stripeLastWebhookAt: null,
    }),
    ...(changes.checkoutMode && { checkoutMode: changes.checkoutMode }),
  });
  return readPaymentSettings(shop);
}

/** Forgets the keys pasted in the admin. Keys set in the environment stay. */
export async function disconnectStripe(shop: ShopContext): Promise<PaymentSettings> {
  await updateShopSettingsRow(shop.database, DEFAULT_TENANT_ID, {
    stripeSecretKey: null,
    stripePublishableKey: null,
    stripeWebhookSecret: null,
    stripeLastWebhookAt: null,
  });
  return readPaymentSettings(shop);
}

/** "Check connection": asks Stripe who the saved key belongs to. */
export async function checkStripeConnection(
  shop: ShopContext,
): Promise<{ accountId: string; accountName: string; mode: "test" | "live" }> {
  const keys = await shop.stripeKeys();
  if (!keys.secretKey) {
    throw new PaymentProviderError("There is no Stripe secret key yet. Paste one in step 2 first.");
  }
  const account = await checkSecretKey(shop, keys.secretKey.value);
  return {
    accountId: account.id,
    accountName: account.name,
    mode: stripeKeyMode(keys.secretKey.value),
  };
}

async function checkSecretKey(shop: ShopContext, secretKey: string) {
  try {
    return await retrieveStripeAccount(shop.stripeWithKey(secretKey));
  } catch (error) {
    if (error instanceof StripeRequestError) {
      throw new PaymentProviderError(
        error.status === 401
          ? "Stripe didn't accept that secret key. Check you copied all of it, from Developers → API keys."
          : `Stripe couldn't check the key: ${error.message}`,
      );
    }
    throw error;
  }
}

function hintFor(secretKey: string): string {
  const prefix = secretKey.slice(0, secretKey.indexOf("_", 3) + 1);
  return `${prefix}…${secretKey.slice(-4)}`;
}

function modeOfPublishable(publishableKey: string): "test" | "live" {
  return publishableKey.startsWith("pk_live_") ? "live" : "test";
}
