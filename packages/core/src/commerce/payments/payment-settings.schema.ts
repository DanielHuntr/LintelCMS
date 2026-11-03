import { z } from "zod";
import { checkoutModes } from "../settings/shop-settings.table.js";
import {
  PUBLISHABLE_KEY_PATTERN,
  SECRET_KEY_PATTERN,
  WEBHOOK_SECRET_PATTERN,
} from "./stripe-keys.js";

/**
 * `PUT /shop/settings/payments`: the keys pasted in the "Connect Stripe" steps. Each is
 * checked for the right prefix first, because pasting the wrong one is the usual mistake.
 */
export const updatePaymentSettingsRequestSchema = z.object({
  secretKey: z
    .string()
    .trim()
    .regex(SECRET_KEY_PATTERN, {
      error:
        "That isn't a secret key. In Stripe, open Developers → API keys and copy the “Secret key”, which starts with sk_test_",
    })
    .optional(),
  publishableKey: z
    .string()
    .trim()
    .regex(PUBLISHABLE_KEY_PATTERN, {
      error:
        "That isn't a publishable key. In Stripe, open Developers → API keys and copy the “Publishable key”, which starts with pk_test_",
    })
    .optional(),
  webhookSecret: z
    .string()
    .trim()
    .regex(WEBHOOK_SECRET_PATTERN, {
      error:
        "That isn't a signing secret. In Stripe, open your webhook endpoint and reveal the “Signing secret”, which starts with whsec_",
    })
    .optional(),
  checkoutMode: z
    .enum(checkoutModes, { error: "The checkout should be hosted or embedded" })
    .optional(),
});

export type UpdatePaymentSettingsRequest = z.infer<typeof updatePaymentSettingsRequestSchema>;

const keySourceSchema = z.enum(["environment", "admin"]);

export const paymentSettingsSchema = z.object({
  connected: z.boolean(),
  /** The shop is on this computer or a private network, so no webhook can reach it. */
  siteIsLocal: z.boolean(),
  /** Lintel asks Stripe about payments itself, because no webhook is doing it. */
  checksForPayments: z.boolean(),
  /** "test" while using test keys: no real money moves. */
  mode: z.enum(["test", "live"]).nullable(),
  /** Only the end of the secret key is ever shown: sk_test_…4242. */
  secretKey: z.object({ hint: z.string(), source: keySourceSchema }).nullable(),
  publishableKey: z.object({ value: z.string(), source: keySourceSchema }).nullable(),
  webhookSecret: z.object({ source: keySourceSchema }).nullable(),
  /** The address to give Stripe for webhooks. */
  webhookUrl: z.string(),
  /** The events to tick when adding the webhook in Stripe. */
  webhookEvents: z.array(z.string()),
  checkoutMode: z.enum(checkoutModes),
});

export type PaymentSettings = z.infer<typeof paymentSettingsSchema>;
