import type { Environment } from "./stripe-keys.js";
import type { SavedMollieCredentials, SavedPayPalCredentials } from "./payment-accounts.table.js";

/**
 * Where the PayPal and Mollie keys come from. As with Stripe, keys in the server's
 * environment win, so a host can lock them down; otherwise the ones saved in the admin.
 *
 *   PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET   the REST app's credentials
 *   PAYPAL_WEBHOOK_ID                         the webhook's id, for verifying events
 *   PAYPAL_ENVIRONMENT                        "sandbox" (the default) or "live"
 *   MOLLIE_API_KEY                            test_… or live_…
 */
export type CredentialSource = "environment" | "admin";

export interface PayPalCredentials extends SavedPayPalCredentials {
  source: CredentialSource;
}

export interface MollieCredentials extends SavedMollieCredentials {
  source: CredentialSource;
}

export function resolvePayPalCredentials(
  saved: SavedPayPalCredentials | null,
  environment: Environment,
): PayPalCredentials | null {
  const clientId = environment.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = environment.PAYPAL_CLIENT_SECRET?.trim();
  if (clientId && clientSecret) {
    return {
      clientId,
      clientSecret,
      webhookId: environment.PAYPAL_WEBHOOK_ID?.trim() || null,
      environment: environment.PAYPAL_ENVIRONMENT?.trim() === "live" ? "live" : "sandbox",
      source: "environment",
    };
  }
  return saved ? { ...saved, source: "admin" } : null;
}

export function resolveMollieCredentials(
  saved: SavedMollieCredentials | null,
  environment: Environment,
): MollieCredentials | null {
  const apiKey = environment.MOLLIE_API_KEY?.trim();
  if (apiKey) return { apiKey, source: "environment" };
  return saved ? { ...saved, source: "admin" } : null;
}

export const MOLLIE_API_KEY_PATTERN = /^(test|live)_[A-Za-z0-9]{20,}$/;

export function mollieKeyMode(apiKey: string): "test" | "live" {
  return apiKey.startsWith("live_") ? "live" : "test";
}

/** "AbC…wXyZ": enough to recognise a key, never enough to use it. */
export function hintForSecret(secret: string): string {
  return secret.length > 8 ? `${secret.slice(0, 5)}…${secret.slice(-4)}` : "…";
}
