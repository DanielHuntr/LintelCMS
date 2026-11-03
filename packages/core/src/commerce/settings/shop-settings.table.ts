import { boolean, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { tenantId, timestamps } from "../../database/columns.js";

export const taxCalculations = ["stripe", "manual"] as const;
export type TaxCalculation = (typeof taxCalculations)[number];

export const checkoutModes = ["hosted", "embedded"] as const;
export type CheckoutMode = (typeof checkoutModes)[number];

/** A tax rate typed in by hand, for development or for shops that don't use Stripe Tax. */
export interface ManualTaxRate {
  country: string;
  /** Percent, such as 20 for UK VAT. */
  rate: number;
  name: string;
}

/**
 * One row per tenant: the shop's own settings. Kept apart from the CMS settings so the
 * shop can be switched off (or moved into its own plugin) without leaving keys behind.
 *
 * The Stripe keys typed into the admin are kept here so a non-technical owner can connect
 * without editing files; keys in the environment (STRIPE_SECRET_KEY and friends) win over
 * them. The secret key is never sent back to the admin, only its last four characters.
 */
export const shopSettingsTable = pgTable("shop_settings", {
  tenantId: tenantId().primaryKey(),
  shopName: text("shop_name").notNull().default(""),
  supportEmail: text("support_email").notNull().default(""),
  taxCalculation: text("tax_calculation", { enum: taxCalculations }).notNull().default("stripe"),
  manualTaxRates: jsonb("manual_tax_rates").$type<ManualTaxRate[]>().notNull().default([]),
  taxShipping: boolean("tax_shipping").notNull().default(true),
  checkoutMode: text("checkout_mode", { enum: checkoutModes }).notNull().default("hosted"),
  stripeSecretKey: text("stripe_secret_key"),
  stripePublishableKey: text("stripe_publishable_key"),
  stripeWebhookSecret: text("stripe_webhook_secret"),
  /** How far Lintel has read Stripe's events itself, when no webhook can reach the shop. */
  stripeEventsCheckedUntil: timestamp("stripe_events_checked_until", { withTimezone: true }),
  /** When a signed webhook last arrived; emptied when a new signing secret is saved. */
  stripeLastWebhookAt: timestamp("stripe_last_webhook_at", { withTimezone: true }),
  orderNumberPrefix: text("order_number_prefix").notNull().default("#"),
  /** The number the next order gets; taken and increased in one statement. */
  nextOrderNumber: integer("next_order_number").notNull().default(1001),
  ...timestamps(),
});

export type ShopSettingsRow = typeof shopSettingsTable.$inferSelect;
