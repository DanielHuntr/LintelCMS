import type { ShopSettingsRow } from "../settings/shop-settings.table.js";

/**
 * Where each Stripe key comes from. A key set in the server's environment always wins, so a
 * host can lock the keys down; otherwise the ones pasted in Shop → Settings → Payments are used.
 *
 *   STRIPE_SECRET_KEY        sk_test_... (or a restricted rk_test_... key)
 *   STRIPE_PUBLISHABLE_KEY   pk_test_...
 *   STRIPE_WEBHOOK_SECRET    whsec_...
 */
export type StripeKeySource = "environment" | "admin";

export interface StripeKey {
  value: string;
  source: StripeKeySource;
}

export interface StripeKeys {
  secretKey: StripeKey | null;
  publishableKey: StripeKey | null;
  webhookSecret: StripeKey | null;
}

export type Environment = Readonly<Record<string, string | undefined>>;

export function resolveStripeKeys(settings: ShopSettingsRow, environment: Environment): StripeKeys {
  return {
    secretKey: pick(environment.STRIPE_SECRET_KEY, settings.stripeSecretKey),
    publishableKey: pick(environment.STRIPE_PUBLISHABLE_KEY, settings.stripePublishableKey),
    webhookSecret: pick(environment.STRIPE_WEBHOOK_SECRET, settings.stripeWebhookSecret),
  };
}

/** "test" for sk_test_ and rk_test_ keys, "live" for live ones. */
export function stripeKeyMode(secretKey: string): "test" | "live" {
  return /^(sk|rk)_live_/.test(secretKey) ? "live" : "test";
}

export const SECRET_KEY_PATTERN = /^(sk|rk)_(test|live)_[A-Za-z0-9]+$/;
export const PUBLISHABLE_KEY_PATTERN = /^pk_(test|live)_[A-Za-z0-9]+$/;
export const WEBHOOK_SECRET_PATTERN = /^whsec_[A-Za-z0-9+/=]+$/;

function pick(fromEnvironment: string | undefined, fromAdmin: string | null): StripeKey | null {
  if (fromEnvironment && fromEnvironment.trim() !== "") {
    return { value: fromEnvironment.trim(), source: "environment" };
  }
  if (fromAdmin) {
    return { value: fromAdmin, source: "admin" };
  }
  return null;
}
