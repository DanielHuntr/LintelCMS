import { jsonb, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import { tenantId, timestamps } from "../../database/columns.js";

export const connectableProviders = ["paypal", "mollie"] as const;
export type ConnectableProvider = (typeof connectableProviders)[number];

/** PayPal's REST app credentials, from developer.paypal.com → Apps & Credentials. */
export interface SavedPayPalCredentials {
  clientId: string;
  clientSecret: string;
  webhookId: string | null;
  environment: "sandbox" | "live";
}

/** Mollie's API key, test_… or live_…, from Mollie's dashboard → Developers → API keys. */
export interface SavedMollieCredentials {
  apiKey: string;
}

/**
 * The keys for the payment providers other than Stripe (whose keys are in shop_settings),
 * one row per provider, saved from the "Connect" steps in Shop → Settings → Payments.
 * Keys in the environment (PAYPAL_CLIENT_ID, MOLLIE_API_KEY...) win over these. Secrets are
 * never sent back to the admin, only their last four characters.
 */
export const paymentAccountsTable = pgTable(
  "shop_payment_accounts",
  {
    tenantId: tenantId(),
    provider: text("provider", { enum: connectableProviders }).notNull(),
    credentials: jsonb("credentials")
      .$type<SavedPayPalCredentials | SavedMollieCredentials>()
      .notNull(),
    ...timestamps(),
  },
  (table) => [primaryKey({ columns: [table.tenantId, table.provider] })],
);

/**
 * Webhook events from PayPal already handled, by PayPal's event id, recorded in the same
 * transaction as the work so a repeat does nothing (as shop_stripe_events does for Stripe).
 */
export const paymentEventsTable = pgTable(
  "shop_payment_events",
  {
    tenantId: tenantId(),
    provider: text("provider", { enum: connectableProviders }).notNull(),
    eventId: text("event_id").notNull(),
    type: text("type").notNull(),
    ...timestamps(),
  },
  (table) => [primaryKey({ columns: [table.provider, table.eventId] })],
);

export type PaymentAccountRow = typeof paymentAccountsTable.$inferSelect;
