import { z } from "zod";
import { paymentProviderIds } from "./payment-provider.js";
import { MOLLIE_API_KEY_PATTERN } from "./provider-credentials.js";

/** `PUT /shop/settings/payment-providers/paypal`: the REST app's credentials. */
export const connectPayPalRequestSchema = z.object({
  clientId: z
    .string({ error: "Please paste the Client ID" })
    .trim()
    .regex(/^[A-Za-z0-9_-]{20,}$/, {
      error:
        "That doesn't look like a PayPal Client ID. In PayPal's developer dashboard, open Apps & Credentials, choose your app and copy the “Client ID”",
    }),
  clientSecret: z
    .string({ error: "Please paste the Secret" })
    .trim()
    .regex(/^[A-Za-z0-9_-]{20,}$/, {
      error:
        "That doesn't look like a PayPal secret. Under your app's “Secret key 1”, choose Show and copy all of it",
    }),
  webhookId: z
    .string()
    .trim()
    .regex(/^[A-Z0-9]{8,40}$/, {
      error:
        "That doesn't look like a webhook ID. It's the short code shown next to your webhook, like 8PT597110X687430LKGECATA",
    })
    .nullish()
    .transform((value) => value ?? null),
  environment: z
    .enum(["sandbox", "live"], { error: "Choose sandbox (testing) or live" })
    .default("sandbox"),
});

/** `PUT /shop/settings/payment-providers/mollie` */
export const connectMollieRequestSchema = z.object({
  apiKey: z.string({ error: "Please paste the API key" }).trim().regex(MOLLIE_API_KEY_PATTERN, {
    error:
      "That isn't a Mollie API key. In Mollie's dashboard, open Developers → API keys and copy the key that starts with test_",
  }),
});

export type ConnectPayPalRequest = z.infer<typeof connectPayPalRequestSchema>;
export type ConnectMollieRequest = z.infer<typeof connectMollieRequestSchema>;

const sourceSchema = z.enum(["environment", "admin"]);

export const paymentProvidersSchema = z.object({
  paypal: z.object({
    connected: z.boolean(),
    mode: z.enum(["test", "live"]).nullable(),
    source: sourceSchema.nullable(),
    clientIdHint: z.string().nullable(),
    webhookIdSet: z.boolean(),
    webhookUrl: z.string(),
    webhookEvents: z.array(z.string()),
  }),
  mollie: z.object({
    connected: z.boolean(),
    mode: z.enum(["test", "live"]).nullable(),
    source: sourceSchema.nullable(),
    apiKeyHint: z.string().nullable(),
    /** The address Mollie is told to call; null while the API is on localhost. */
    webhookUrl: z.string().nullable(),
  }),
  /** Which provider each market's shoppers pay with. */
  markets: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      currency: z.string(),
      paymentProvider: z.enum(paymentProviderIds),
    }),
  ),
});

export type PaymentProviders = z.infer<typeof paymentProvidersSchema>;
