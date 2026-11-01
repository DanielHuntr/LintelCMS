import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../../database/columns.js";
import { usersTable } from "../../users/users.table.js";
import type { AppliedDiscount, ShippingLine } from "../checkouts/checkouts.table.js";
import type { Address } from "../customers/address.schema.js";
import { customersTable } from "../customers/customers.table.js";

export const paymentStatuses = ["paid", "partially_refunded", "refunded"] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];

export const fulfilmentStatuses = ["unfulfilled", "partially_fulfilled", "fulfilled"] as const;
export type FulfilmentStatus = (typeof fulfilmentStatuses)[number];

/**
 * A paid order. Orders only exist once Stripe has confirmed the payment in a signed
 * webhook, so every order here has been paid; what can change afterwards is how much has
 * been refunded (`paymentStatus`), how much has been sent (`fulfilmentStatus`), and whether
 * it was cancelled (`cancelledAt`).
 *
 * `number` counts up per shop (1001, 1002...) with no gaps, because abandoned checkouts
 * never take one; `name` is how people say it: "#1001".
 */
export const ordersTable = pgTable(
  "shop_orders",
  {
    id: id(),
    tenantId: tenantId(),
    number: integer("number").notNull(),
    name: text("name").notNull(),
    checkoutId: uuid("checkout_id").notNull(),
    customerId: uuid("customer_id").references(() => customersTable.id, {
      onDelete: "set null",
    }),
    email: text("email").notNull(),
    marketId: uuid("market_id"),
    currency: text("currency").notNull(),
    shippingAddress: jsonb("shipping_address").$type<Address>().notNull(),
    shippingLine: jsonb("shipping_line").$type<ShippingLine>().notNull(),
    discounts: jsonb("discounts").$type<AppliedDiscount[]>().notNull().default([]),
    subtotalAmount: integer("subtotal_amount").notNull(),
    discountAmount: integer("discount_amount").notNull(),
    shippingAmount: integer("shipping_amount").notNull(),
    taxAmount: integer("tax_amount").notNull(),
    totalAmount: integer("total_amount").notNull(),
    refundedAmount: integer("refunded_amount").notNull().default(0),
    taxesIncluded: boolean("taxes_included").notNull(),
    paymentStatus: text("payment_status", { enum: paymentStatuses }).notNull().default("paid"),
    fulfilmentStatus: text("fulfilment_status", { enum: fulfilmentStatuses })
      .notNull()
      .default("unfulfilled"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("shop_orders_number_idx").on(table.tenantId, table.number),
    uniqueIndex("shop_orders_checkout_idx").on(table.checkoutId),
    index("shop_orders_created_idx").on(table.tenantId, table.createdAt),
    index("shop_orders_customer_idx").on(table.customerId),
    index("shop_orders_payment_intent_idx").on(table.stripePaymentIntentId),
  ],
);

/** What was bought, copied from the checkout so later product edits don't change history. */
export const orderLinesTable = pgTable(
  "shop_order_lines",
  {
    id: id(),
    tenantId: tenantId(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => ordersTable.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id"),
    productId: uuid("product_id"),
    productTitle: text("product_title").notNull(),
    variantTitle: text("variant_title").notNull(),
    sku: text("sku"),
    imageId: uuid("image_id"),
    quantity: integer("quantity").notNull(),
    unitAmount: integer("unit_amount").notNull(),
    subtotalAmount: integer("subtotal_amount").notNull(),
    discountAmount: integer("discount_amount").notNull(),
    taxAmount: integer("tax_amount").notNull(),
    weightGrams: integer("weight_grams").notNull().default(0),
    fulfilledQuantity: integer("fulfilled_quantity").notNull().default(0),
    refundedQuantity: integer("refunded_quantity").notNull().default(0),
    position: integer("position").notNull().default(0),
  },
  (table) => [index("shop_order_lines_order_idx").on(table.orderId, table.position)],
);

/** A line and how many of it, for refunds and fulfilments. */
export interface LineQuantity {
  orderLineId: string;
  quantity: number;
}

export const refundStatuses = ["pending", "succeeded", "failed"] as const;
export type RefundStatus = (typeof refundStatuses)[number];

/**
 * Money given back through Stripe. The order's refunded amount only counts refunds Stripe
 * says have `succeeded`. Refunds made in Stripe's own dashboard arrive by webhook and are
 * recorded here too, with no `createdBy`.
 */
export const refundsTable = pgTable(
  "shop_refunds",
  {
    id: id(),
    tenantId: tenantId(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => ordersTable.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    reason: text("reason").notNull().default(""),
    status: text("status", { enum: refundStatuses }).notNull().default("pending"),
    lines: jsonb("lines").$type<LineQuantity[]>().notNull().default([]),
    restock: boolean("restock").notNull().default(false),
    notifyCustomer: boolean("notify_customer").notNull().default(true),
    stripeRefundId: text("stripe_refund_id"),
    createdBy: uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (table) => [
    index("shop_refunds_order_idx").on(table.orderId),
    uniqueIndex("shop_refunds_stripe_idx").on(table.stripeRefundId),
  ],
);

/** A parcel sent: which lines, and how to track it. */
export const fulfilmentsTable = pgTable(
  "shop_fulfilments",
  {
    id: id(),
    tenantId: tenantId(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => ordersTable.id, { onDelete: "cascade" }),
    lines: jsonb("lines").$type<LineQuantity[]>().notNull(),
    trackingCompany: text("tracking_company").notNull().default(""),
    trackingNumber: text("tracking_number").notNull().default(""),
    trackingUrl: text("tracking_url").notNull().default(""),
    createdBy: uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (table) => [index("shop_fulfilments_order_idx").on(table.orderId)],
);

/**
 * The order's timeline: "Payment of €42.00 received", "Shipped with Royal Mail", notes
 * staff leave for each other. Written by the services, never edited.
 */
export const orderEventsTable = pgTable(
  "shop_order_events",
  {
    id: id(),
    tenantId: tenantId(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => ordersTable.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    message: text("message").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    createdBy: uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (table) => [index("shop_order_events_order_idx").on(table.orderId, table.createdAt)],
);

export type OrderRow = typeof ordersTable.$inferSelect;
export type NewOrderRow = typeof ordersTable.$inferInsert;
export type OrderLineRow = typeof orderLinesTable.$inferSelect;
export type RefundRow = typeof refundsTable.$inferSelect;
export type FulfilmentRow = typeof fulfilmentsTable.$inferSelect;
export type OrderEventRow = typeof orderEventsTable.$inferSelect;
