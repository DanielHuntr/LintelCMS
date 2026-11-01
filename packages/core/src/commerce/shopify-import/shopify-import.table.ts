import {
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
import type { Address } from "../customers/address.schema.js";
import { customersTable } from "../customers/customers.table.js";
import type { ShopifyCustomer } from "./shopify-customers.js";
import type { ShopifyOrder } from "./shopify-orders.js";
import type { ShopifyProduct } from "./shopify-products.js";

export const importStatuses = ["ready", "importing", "completed"] as const;
export type ImportStatus = (typeof importStatuses)[number];

export const importStages = ["products", "collections", "customers", "orders", "done"] as const;
export type ImportStage = (typeof importStages)[number];

/** What was read from the files, kept so the import can stop and carry on. */
export interface ImportPlan {
  products: ShopifyProduct[];
  customers: ShopifyCustomer[];
  orders: ShopifyOrder[];
  /** Which columns each file had, for the mapping screen. */
  columns: { products: string[]; customers: string[]; orders: string[] };
}

/** The choices on the mapping screen. */
export interface ImportOptions {
  /** Keep Shopify's status (on sale, draft, archived), or bring everything in as a draft. */
  productStatus: "keep" | "draft";
  importImages: boolean;
  /** Make collections from the file's "Collection" column. */
  collectionsFromColumn: boolean;
  /** Tags that become collections (one automatic collection each, "tag is …"). */
  tagCollections: string[];
  importCustomers: boolean;
  importOrders: boolean;
  /** Where products live on the new site, for redirect suggestions: "/products/". */
  productPathPrefix: string;
}

export interface ImportCounts {
  created: number;
  skipped: number;
  failed: number;
}

export interface ImportReport {
  products: ImportCounts;
  collections: ImportCounts;
  customers: ImportCounts;
  orders: ImportCounts;
  images: { downloaded: number; skipped: number };
  /** Everything not brought in, and why, in words for the shop owner. */
  problems: Array<{ stage: ImportStage; item: string; message: string }>;
  /** Old Shopify address → new address, for every product whose address changes. */
  redirects: Array<{ fromPath: string; toPath: string }>;
  /** Lintel's product handle for each Shopify handle imported, for collections. */
  productHandles: Record<string, string>;
}

/**
 * One move from Shopify, from the files read to the final report. It is worked through a
 * few items at a time (`stage` and `position` say where it is), so it shows progress, can
 * stop at any point (a closed tab, a restart) and carries on where it left off.
 * `leaseUntil` stops two windows working on it at once.
 */
export const shopifyImportsTable = pgTable(
  "shop_shopify_imports",
  {
    id: id(),
    tenantId: tenantId(),
    status: text("status", { enum: importStatuses }).notNull().default("ready"),
    plan: jsonb("plan").$type<ImportPlan>().notNull(),
    options: jsonb("options").$type<ImportOptions>().notNull(),
    stage: text("stage", { enum: importStages }).notNull().default("products"),
    position: integer("position").notNull().default(0),
    report: jsonb("report").$type<ImportReport>().notNull(),
    /** What a dry run said would happen, kept to show again. */
    dryRunReport: jsonb("dry_run_report").$type<ImportReport>(),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (table) => [index("shop_shopify_imports_tenant_idx").on(table.tenantId, table.createdAt)],
);

export interface ArchivedOrderLine {
  title: string;
  sku: string;
  quantity: number;
  unitAmount: number;
}

/**
 * An order from before the move, kept as a record: what was bought, by whom, for how
 * much. It was paid elsewhere, so it can't be refunded or sent from Lintel, and it never
 * takes an order number.
 */
export const archivedOrdersTable = pgTable(
  "shop_archived_orders",
  {
    id: id(),
    tenantId: tenantId(),
    source: text("source").notNull().default("shopify"),
    name: text("name").notNull(),
    email: text("email").notNull().default(""),
    customerId: uuid("customer_id").references(() => customersTable.id, {
      onDelete: "set null",
    }),
    currency: text("currency").notNull(),
    subtotalAmount: integer("subtotal_amount").notNull().default(0),
    discountAmount: integer("discount_amount").notNull().default(0),
    shippingAmount: integer("shipping_amount").notNull().default(0),
    taxAmount: integer("tax_amount").notNull().default(0),
    totalAmount: integer("total_amount").notNull().default(0),
    refundedAmount: integer("refunded_amount").notNull().default(0),
    paymentStatus: text("payment_status").notNull().default(""),
    fulfilmentStatus: text("fulfilment_status").notNull().default(""),
    discountCodes: jsonb("discount_codes").$type<string[]>().notNull().default([]),
    lines: jsonb("lines").$type<ArchivedOrderLine[]>().notNull().default([]),
    shippingAddress: jsonb("shipping_address").$type<Address>(),
    placedAt: timestamp("placed_at", { withTimezone: true }).notNull(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("shop_archived_orders_name_idx").on(table.tenantId, table.source, table.name),
    index("shop_archived_orders_customer_idx").on(table.customerId),
    index("shop_archived_orders_placed_idx").on(table.tenantId, table.placedAt),
  ],
);

export type ShopifyImportRow = typeof shopifyImportsTable.$inferSelect;
export type ArchivedOrderRow = typeof archivedOrdersTable.$inferSelect;
export type NewArchivedOrderRow = typeof archivedOrdersTable.$inferInsert;
