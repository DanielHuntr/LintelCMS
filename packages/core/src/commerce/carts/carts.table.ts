import { index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../../database/columns.js";
import type { Address } from "../customers/address.schema.js";
import { marketsTable } from "../markets/markets.table.js";
import { variantsTable } from "../products/products.table.js";

/**
 * A shopper's basket, before they check out. Carts are anonymous: the storefront holds a
 * random token and Lintel keeps only its SHA-256 (`tokenHash`), so a copy of the database
 * can't be used to open someone's cart.
 *
 * The cart's market (and so its currency) follows its country.
 */
export const cartsTable = pgTable(
  "shop_carts",
  {
    id: id(),
    tenantId: tenantId(),
    tokenHash: text("token_hash").notNull(),
    marketId: uuid("market_id")
      .notNull()
      .references(() => marketsTable.id, { onDelete: "cascade" }),
    country: text("country"),
    email: text("email"),
    shippingAddress: jsonb("shipping_address").$type<Address>(),
    shippingRateId: uuid("shipping_rate_id"),
    discountCodes: jsonb("discount_codes").$type<string[]>().notNull().default([]),
    ...timestamps(),
  },
  (table) => [uniqueIndex("shop_carts_token_idx").on(table.tokenHash)],
);

export const cartLinesTable = pgTable(
  "shop_cart_lines",
  {
    id: id(),
    tenantId: tenantId(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => cartsTable.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => variantsTable.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("shop_cart_lines_variant_idx").on(table.cartId, table.variantId),
    index("shop_cart_lines_cart_idx").on(table.cartId, table.createdAt),
  ],
);

export type CartRow = typeof cartsTable.$inferSelect;
export type CartLineRow = typeof cartLinesTable.$inferSelect;
