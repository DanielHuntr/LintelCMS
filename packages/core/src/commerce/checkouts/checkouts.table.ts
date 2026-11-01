import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../../database/columns.js";
import type { Address } from "../customers/address.schema.js";

/** One line of a checkout or order, priced and taxed. Amounts are minor units. */
export interface PricedLine {
  variantId: string;
  productId: string;
  productTitle: string;
  variantTitle: string;
  sku: string | null;
  imageId: string | null;
  quantity: number;
  unitAmount: number;
  /** unitAmount × quantity, before discounts. */
  subtotalAmount: number;
  discountAmount: number;
  taxAmount: number;
  weightGrams: number;
}

export interface ShippingLine {
  rateId: string;
  name: string;
  amount: number;
  taxAmount: number;
}

export interface AppliedDiscount {
  code: string;
  title: string;
  amount: number;
}

export const checkoutStatuses = ["open", "completed", "expired", "needs_review"] as const;
export type CheckoutStatus = (typeof checkoutStatuses)[number];

/**
 * A cart frozen at the moment the shopper went to pay: prices, tax and shipping worked out
 * and stock reserved. It becomes an order only when Stripe confirms the payment in a
 * signed webhook; until then it is `open`, and it is `expired` when the payment window
 * closes. `needs_review` means Stripe reported a payment that didn't match the total, which
 * is never turned into an order automatically.
 */
export const checkoutsTable = pgTable(
  "shop_checkouts",
  {
    id: id(),
    tenantId: tenantId(),
    cartId: uuid("cart_id"),
    marketId: uuid("market_id").notNull(),
    status: text("status", { enum: checkoutStatuses }).notNull().default("open"),
    email: text("email").notNull(),
    shippingAddress: jsonb("shipping_address").$type<Address>().notNull(),
    currency: text("currency").notNull(),
    lines: jsonb("lines").$type<PricedLine[]>().notNull(),
    shippingLine: jsonb("shipping_line").$type<ShippingLine>().notNull(),
    discounts: jsonb("discounts").$type<AppliedDiscount[]>().notNull().default([]),
    subtotalAmount: integer("subtotal_amount").notNull(),
    discountAmount: integer("discount_amount").notNull(),
    shippingAmount: integer("shipping_amount").notNull(),
    taxAmount: integer("tax_amount").notNull(),
    totalAmount: integer("total_amount").notNull(),
    taxesIncluded: boolean("taxes_included").notNull(),
    /** "stripe" or "manual", and Stripe's tax calculation id when it did the sums. */
    taxCalculation: text("tax_calculation").notNull(),
    taxReference: text("tax_reference"),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    problem: text("problem"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    orderId: uuid("order_id"),
    ...timestamps(),
  },
  (table) => [
    index("shop_checkouts_status_idx").on(table.tenantId, table.status, table.expiresAt),
    index("shop_checkouts_session_idx").on(table.stripeCheckoutSessionId),
  ],
);

export type CheckoutRow = typeof checkoutsTable.$inferSelect;
export type NewCheckoutRow = typeof checkoutsTable.$inferInsert;
