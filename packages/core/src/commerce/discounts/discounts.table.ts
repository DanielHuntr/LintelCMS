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

export const discountMethods = ["code", "automatic"] as const;
export type DiscountMethod = (typeof discountMethods)[number];

export const discountKinds = [
  "percentage",
  "fixed_amount",
  "free_shipping",
  "buy_x_get_y",
] as const;
export type DiscountKind = (typeof discountKinds)[number];

export const discountScopes = ["order", "products", "collections"] as const;
export type DiscountScope = (typeof discountScopes)[number];

/** Minor units per currency: `{ GBP: 1000, EUR: 1200 }`. */
export type AmountsByCurrency = Record<string, number>;

/**
 * A way to take money off an order: a code the shopper types ("SUMMER20"), or an
 * automatic discount that applies whenever its conditions are met.
 *
 *   percentage      `percentOff` of the items in scope
 *   fixed_amount    `amounts[currency]` off the items in scope (no amount: not offered there)
 *   free_shipping   the chosen delivery rate costs nothing
 *   buy_x_get_y     for every `buyQuantity` bought, `getQuantity` more of the cheapest items
 *                   in scope get `percentOff` (100 makes them free)
 *
 * `minimumSpend` (per currency) and `minimumQuantity` count only the items in scope.
 * Usage is counted in `shop_discount_redemptions`, held while a checkout is open, so two
 * shoppers can't both take the last use of a limited code.
 *
 * `combinesWithOthers` off makes a discount exclusive: it never applies alongside another.
 */
export const discountsTable = pgTable(
  "shop_discounts",
  {
    id: id(),
    tenantId: tenantId(),
    title: text("title").notNull(),
    method: text("method", { enum: discountMethods }).notNull(),
    /** Upper case, so codes match however they're typed. Null for automatic discounts. */
    code: text("code"),
    kind: text("kind", { enum: discountKinds }).notNull(),
    percentOff: integer("percent_off").notNull().default(0),
    amounts: jsonb("amounts").$type<AmountsByCurrency>().notNull().default({}),
    buyQuantity: integer("buy_quantity").notNull().default(0),
    getQuantity: integer("get_quantity").notNull().default(0),
    scope: text("scope", { enum: discountScopes }).notNull().default("order"),
    productIds: jsonb("product_ids").$type<string[]>().notNull().default([]),
    collectionIds: jsonb("collection_ids").$type<string[]>().notNull().default([]),
    minimumSpend: jsonb("minimum_spend").$type<AmountsByCurrency>().notNull().default({}),
    minimumQuantity: integer("minimum_quantity"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    usageLimit: integer("usage_limit"),
    perCustomerLimit: integer("per_customer_limit"),
    combinesWithOthers: boolean("combines_with_others").notNull().default(true),
    enabled: boolean("enabled").notNull().default(true),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("shop_discounts_code_idx").on(table.tenantId, table.code),
    index("shop_discounts_method_idx").on(table.tenantId, table.method, table.enabled),
  ],
);

export const redemptionStatuses = ["held", "used", "released"] as const;
export type RedemptionStatus = (typeof redemptionStatuses)[number];

/**
 * One use of a discount by one checkout. `held` while the shopper is paying, `used` once
 * the order is placed, `released` when the checkout is abandoned. Held and used ones count
 * against the limits.
 */
export const discountRedemptionsTable = pgTable(
  "shop_discount_redemptions",
  {
    id: id(),
    tenantId: tenantId(),
    discountId: uuid("discount_id")
      .notNull()
      .references(() => discountsTable.id, { onDelete: "cascade" }),
    checkoutId: uuid("checkout_id").notNull(),
    orderId: uuid("order_id"),
    email: text("email").notNull(),
    status: text("status", { enum: redemptionStatuses }).notNull().default("held"),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("shop_discount_redemptions_checkout_idx").on(table.discountId, table.checkoutId),
    index("shop_discount_redemptions_discount_idx").on(table.discountId, table.status),
    index("shop_discount_redemptions_email_idx").on(table.discountId, table.email),
  ],
);

export type DiscountRow = typeof discountsTable.$inferSelect;
export type NewDiscountRow = typeof discountsTable.$inferInsert;
export type DiscountRedemptionRow = typeof discountRedemptionsTable.$inferSelect;
