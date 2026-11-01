import { z } from "zod";
import { currencyCodeSchema } from "../money/currencies.js";
import { minorAmountSchema } from "../money/money.js";
import { productStatuses } from "./products.table.js";

const text = (label: string, max: number) =>
  z
    .string({ error: `${label} should be text` })
    .trim()
    .max(max, { error: `${label} can be at most ${max} characters` });

const optionalCode = (label: string) =>
  z
    .string({ error: `${label} should be text` })
    .trim()
    .max(64, { error: `${label} can be at most 64 characters` })
    .nullish()
    .transform((value) => (value ? value : null));

/** Product handles go in storefront addresses: /products/linen-shirt. */
const productHandleSchema = z
  .string({ error: "The handle should be text" })
  .trim()
  .max(80, { error: "Handles can be at most 80 characters" })
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    error: "Handles use lowercase letters, numbers and hyphens, like linen-shirt",
  });

const optionSchema = z.object({
  name: text("The option name", 50).min(1, { error: "Each option needs a name, like Size" }),
  values: z
    .array(text("Option values", 50).min(1, { error: "Option values can't be empty" }), {
      error: "Each option needs a list of values",
    })
    .min(1, { error: "Each option needs at least one value, like Small" })
    .max(50, { error: "An option can have at most 50 values" }),
});

const priceSchema = z.object({
  currency: currencyCodeSchema,
  amount: minorAmountSchema,
  compareAtAmount: minorAmountSchema.nullish().transform((value) => value ?? null),
});

const stockLevelSchema = z.object({
  locationId: z.uuid({ error: "Each stock level needs a location id" }),
  onHand: z
    .number({ error: "Stock should be a whole number" })
    .int({ error: "Stock should be a whole number" })
    .min(-1_000_000)
    .max(1_000_000),
});

const variantSchema = z.object({
  id: z.uuid().optional(),
  optionValues: z.array(z.string().trim()).default([]),
  sku: optionalCode("The SKU"),
  barcode: optionalCode("The barcode"),
  weightGrams: z
    .number({ error: "Weight should be a number of grams" })
    .int({ error: "Weight should be a whole number of grams" })
    .min(0, { error: "Weight can't be negative" })
    .max(1_000_000, { error: "That weight is too large" })
    .default(0),
  inventoryTracked: z.boolean().default(true),
  prices: z.array(priceSchema).max(50).default([]),
  stock: z.array(stockLevelSchema).max(50).default([]),
});

/**
 * `POST /shop/products` and `PUT /shop/products/:id`: the whole product, variants included.
 * A variant without an id is new; a saved variant left out of the list is deleted.
 */
export const productRequestSchema = z.object({
  title: text("The title", 200).min(1, { error: "Please give the product a title" }),
  handle: productHandleSchema.optional(),
  description: z
    .object({ type: z.literal("doc") }, { error: "The description should be a rich text document" })
    .loose()
    .nullish()
    .transform((value) => value ?? null),
  status: z
    .enum(productStatuses, { error: "The status should be draft, active or archived" })
    .default("draft"),
  vendor: text("The vendor", 100).default(""),
  productType: text("The product type", 100).default(""),
  tags: z
    .array(text("Tags", 50).min(1))
    .max(50, { error: "A product can have at most 50 tags" })
    .default([])
    .transform((tags) => [...new Set(tags)]),
  mediaIds: z
    .array(z.uuid({ error: "Media should be asset ids" }))
    .max(50)
    .default([]),
  seoTitle: text("The search engine title", 200).default(""),
  seoDescription: text("The search engine description", 500).default(""),
  options: z
    .array(optionSchema)
    .max(3, { error: "A product can have at most 3 options" })
    .default([]),
  variants: z
    .array(variantSchema, { error: "Please send the product's variants" })
    .min(1, { error: "A product needs at least one variant" })
    .max(100, { error: "A product can have at most 100 variants" }),
});

export const listProductsQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: z.enum(productStatuses).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
});

export type ProductRequest = z.infer<typeof productRequestSchema>;
export type VariantRequest = z.infer<typeof variantSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
