import { z } from "zod";
import { importStages, importStatuses } from "./shopify-import.table.js";

const MAX_FILE_CHARACTERS = 25 * 1024 * 1024;

const csvText = (label: string) =>
  z.string({ error: `The ${label} should be the text of the CSV file` }).max(MAX_FILE_CHARACTERS, {
    error: `The ${label} is larger than 25 MB. Export fewer at a time.`,
  });

/**
 * `POST /shop/imports/shopify`: the files exported from Shopify's admin, as text. Only the
 * products file is needed; no Shopify login or API key is ever asked for.
 */
export const startImportRequestSchema = z.object({
  productsCsv: csvText("products file").min(1, {
    error: "Please choose the products file from Shopify",
  }),
  customersCsv: csvText("customers file").optional(),
  ordersCsv: csvText("orders file").optional(),
});

/** `PUT /shop/imports/:id/options`: the choices on the mapping screen. */
export const importOptionsSchema = z.object({
  productStatus: z.enum(["keep", "draft"]),
  importImages: z.boolean(),
  collectionsFromColumn: z.boolean(),
  tagCollections: z.array(z.string().trim().min(1).max(50)).max(100),
  importCustomers: z.boolean(),
  importOrders: z.boolean(),
  productPathPrefix: z
    .string()
    .trim()
    .regex(/^\/([a-z0-9-]+\/)*$/, {
      error: "The product address should start and end with /, like /products/",
    })
    .max(100),
});

/** `POST /shop/imports/:id/run`. `maxItems` makes a batch smaller than its few seconds. */
export const runImportRequestSchema = z.object({
  maxItems: z.number().int().min(1).max(10_000).optional(),
});

export type StartImportRequest = z.infer<typeof startImportRequestSchema>;
export type ImportOptionsRequest = z.infer<typeof importOptionsSchema>;

const countsSchema = z.object({
  created: z.number().int(),
  skipped: z.number().int(),
  failed: z.number().int(),
});

export const importReportSchema = z.object({
  products: countsSchema,
  collections: countsSchema,
  customers: countsSchema,
  orders: countsSchema,
  images: z.object({ downloaded: z.number().int(), skipped: z.number().int() }),
  problems: z.array(
    z.object({ stage: z.enum(importStages), item: z.string(), message: z.string() }),
  ),
  redirects: z.array(z.object({ fromPath: z.string(), toPath: z.string() })),
});

/** One import as the admin sees it: the preview, the mapping, the progress and the report. */
export const shopifyImportSchema = z.object({
  id: z.uuid(),
  status: z.enum(importStatuses),
  /** Where it is, and how far through: "products", 12 of 40. */
  stage: z.enum(importStages),
  done: z.number().int(),
  total: z.number().int(),
  /** True while no window is working on it, so it can be carried on. */
  paused: z.boolean(),
  currency: z.string().nullable(),
  files: z.object({
    products: z.object({ rows: z.number().int() }),
    customers: z.object({ rows: z.number().int() }).nullable(),
    orders: z.object({ rows: z.number().int() }).nullable(),
  }),
  counts: z.object({
    products: z.number().int(),
    variants: z.number().int(),
    images: z.number().int(),
    customers: z.number().int(),
    orders: z.number().int(),
    collectionsInFile: z.array(z.string()),
    tags: z.array(z.object({ tag: z.string(), products: z.number().int() })),
  }),
  /** Which Shopify column becomes which Lintel field (`field` is a stable key), per file. */
  mapping: z.array(
    z.object({
      file: z.enum(["products", "customers", "orders"]),
      column: z.string(),
      field: z.string(),
    }),
  ),
  /** Columns in the files that have nowhere to go in Lintel. */
  notImported: z.array(z.object({ file: z.string(), column: z.string() })),
  /** The first few products, to check the file is the right one. */
  samples: z.array(
    z.object({
      handle: z.string(),
      title: z.string(),
      variants: z.number().int(),
      images: z.number().int(),
      price: z.string(),
      status: z.string(),
    }),
  ),
  warnings: z.array(z.string()),
  options: importOptionsSchema,
  report: importReportSchema,
  dryRunReport: importReportSchema.nullable(),
  createdAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
});

export type ShopifyImport = z.infer<typeof shopifyImportSchema>;

export const archivedOrderSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.string(),
  customerId: z.uuid().nullable(),
  total: z.object({ amount: z.number().int(), currency: z.string() }),
  refunded: z.object({ amount: z.number().int(), currency: z.string() }),
  paymentStatus: z.string(),
  fulfilmentStatus: z.string(),
  discountCodes: z.array(z.string()),
  itemCount: z.number().int(),
  lines: z.array(
    z.object({
      title: z.string(),
      sku: z.string(),
      quantity: z.number().int(),
      unitAmount: z.number().int(),
    }),
  ),
  placedAt: z.iso.datetime(),
  cancelledAt: z.iso.datetime().nullable(),
});

export const listArchivedOrdersQuerySchema = z.object({
  customerId: z.uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});

export type ArchivedOrder = z.infer<typeof archivedOrderSchema>;
