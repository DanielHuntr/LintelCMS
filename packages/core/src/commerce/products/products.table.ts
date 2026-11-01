import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../../database/columns.js";
import type { RichTextDocument } from "../../fieldtypes/rich-text.js";

export const productStatuses = ["draft", "active", "archived"] as const;
export type ProductStatus = (typeof productStatuses)[number];

/** "Size" with "Small", "Medium" and "Large". A product has up to three. */
export interface ProductOption {
  name: string;
  values: string[];
}

/**
 * Something the shop sells. Only `active` products appear on the storefront; `draft` ones
 * are being prepared and `archived` ones are kept for old orders.
 *
 * `mediaIds` are media library assets, in gallery order; the first is the main photo.
 * Options live on the product as a short list, because they are always read and saved with it.
 */
export const productsTable = pgTable(
  "shop_products",
  {
    id: id(),
    tenantId: tenantId(),
    title: text("title").notNull(),
    handle: text("handle").notNull(),
    description: jsonb("description").$type<RichTextDocument>(),
    status: text("status", { enum: productStatuses }).notNull().default("draft"),
    vendor: text("vendor").notNull().default(""),
    productType: text("product_type").notNull().default(""),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    mediaIds: jsonb("media_ids").$type<string[]>().notNull().default([]),
    options: jsonb("options").$type<ProductOption[]>().notNull().default([]),
    seoTitle: text("seo_title").notNull().default(""),
    seoDescription: text("seo_description").notNull().default(""),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("shop_products_handle_idx").on(table.tenantId, table.handle),
    index("shop_products_status_idx").on(table.tenantId, table.status),
  ],
);

/**
 * One buyable version of a product: "T-shirt, Red / Large". Every product has at least one;
 * a product without options has exactly one, titled "Default".
 *
 * `optionValues` line up with the product's options, one value for each.
 * With `inventoryTracked` off the variant is always available (made to order, digital).
 */
export const variantsTable = pgTable(
  "shop_variants",
  {
    id: id(),
    tenantId: tenantId(),
    productId: uuid("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    optionValues: jsonb("option_values").$type<string[]>().notNull().default([]),
    sku: text("sku"),
    barcode: text("barcode"),
    weightGrams: integer("weight_grams").notNull().default(0),
    inventoryTracked: boolean("inventory_tracked").notNull().default(true),
    position: integer("position").notNull().default(0),
    ...timestamps(),
  },
  (table) => [
    index("shop_variants_product_idx").on(table.productId, table.position),
    uniqueIndex("shop_variants_sku_idx").on(table.tenantId, table.sku),
  ],
);

/**
 * A variant's price in one currency, in minor units. The price in the primary market's
 * currency is required; the others are optional and override conversion for that currency.
 * `compareAtAmount` is the "was" price shown crossed out.
 */
export const variantPricesTable = pgTable(
  "shop_variant_prices",
  {
    id: id(),
    tenantId: tenantId(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => variantsTable.id, { onDelete: "cascade" }),
    currency: text("currency").notNull(),
    amount: integer("amount").notNull(),
    compareAtAmount: integer("compare_at_amount"),
  },
  (table) => [uniqueIndex("shop_variant_prices_currency_idx").on(table.variantId, table.currency)],
);

export type ProductRow = typeof productsTable.$inferSelect;
export type NewProductRow = typeof productsTable.$inferInsert;
export type VariantRow = typeof variantsTable.$inferSelect;
export type NewVariantRow = typeof variantsTable.$inferInsert;
export type VariantPriceRow = typeof variantPricesTable.$inferSelect;
