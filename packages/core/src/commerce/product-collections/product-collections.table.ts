import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../../database/columns.js";
import { productsTable } from "../products/products.table.js";

export const productCollectionKinds = ["manual", "automatic"] as const;
export type ProductCollectionKind = (typeof productCollectionKinds)[number];

export const collectionRuleFields = ["tag", "title", "vendor", "productType", "price"] as const;
export const collectionRuleOperators = ["equals", "contains", "greaterThan", "lessThan"] as const;

/**
 * "Tag equals summer", "Price is less than 2000" (minor units of the primary currency).
 * See product-collection-rules.ts for what each pair means.
 */
export interface CollectionRule {
  field: (typeof collectionRuleFields)[number];
  operator: (typeof collectionRuleOperators)[number];
  value: string;
}

/**
 * A group of products shown together: "Summer sale", "T-shirts". Called product
 * collections in code so they're never confused with the CMS's content collections.
 *
 * `manual` collections hold the products picked by hand, in order (the items table).
 * `automatic` ones hold every active product that matches the rules, all of them
 * (`matchAll`) or any of them.
 */
export const productCollectionsTable = pgTable(
  "shop_product_collections",
  {
    id: id(),
    tenantId: tenantId(),
    title: text("title").notNull(),
    handle: text("handle").notNull(),
    description: text("description").notNull().default(""),
    kind: text("kind", { enum: productCollectionKinds }).notNull().default("manual"),
    rules: jsonb("rules").$type<CollectionRule[]>().notNull().default([]),
    matchAll: boolean("match_all").notNull().default(true),
    ...timestamps(),
  },
  (table) => [uniqueIndex("shop_product_collections_handle_idx").on(table.tenantId, table.handle)],
);

export const productCollectionItemsTable = pgTable(
  "shop_product_collection_items",
  {
    tenantId: tenantId(),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => productCollectionsTable.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.collectionId, table.productId] }),
    index("shop_product_collection_items_product_idx").on(table.productId),
  ],
);

export type ProductCollectionRow = typeof productCollectionsTable.$inferSelect;
export type NewProductCollectionRow = typeof productCollectionsTable.$inferInsert;
