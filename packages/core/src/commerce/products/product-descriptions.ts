import { z } from "zod";
import { productStatuses, type ProductRow } from "./products.table.js";
import type { ProductDetails } from "./products.service.js";

/** Products as the admin sees them: everything, drafts included, with stock per location. */

const adminPriceSchema = z.object({
  currency: z.string(),
  amount: z.number().int(),
  compareAtAmount: z.number().int().nullable(),
});

const adminVariantSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  optionValues: z.array(z.string()),
  sku: z.string().nullable(),
  barcode: z.string().nullable(),
  weightGrams: z.number().int(),
  inventoryTracked: z.boolean(),
  prices: z.array(adminPriceSchema),
  stock: z.array(z.object({ locationId: z.uuid(), onHand: z.number().int() })),
  /** On hand minus what checkouts are holding; null when stock isn't tracked. */
  available: z.number().int().nullable(),
  held: z.number().int(),
});

export const adminProductSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  handle: z.string(),
  description: z.record(z.string(), z.unknown()).nullable(),
  status: z.enum(productStatuses),
  vendor: z.string(),
  productType: z.string(),
  tags: z.array(z.string()),
  mediaIds: z.array(z.uuid()),
  seoTitle: z.string(),
  seoDescription: z.string(),
  options: z.array(z.object({ name: z.string(), values: z.array(z.string()) })),
  variants: z.array(adminVariantSchema),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const adminProductSummarySchema = z.object({
  id: z.uuid(),
  title: z.string(),
  handle: z.string(),
  status: z.enum(productStatuses),
  imageId: z.uuid().nullable(),
  variantCount: z.number().int(),
  /** Available across all variants; null when none of them track stock. */
  available: z.number().int().nullable(),
  /** The cheapest and dearest variant in the primary currency, when they have prices. */
  priceRange: z
    .object({ currency: z.string(), min: z.number().int(), max: z.number().int() })
    .nullable(),
  updatedAt: z.iso.datetime(),
});

export type AdminProduct = z.infer<typeof adminProductSchema>;
export type AdminProductSummary = z.infer<typeof adminProductSummarySchema>;

export function describeAdminProduct(row: ProductRow, details: ProductDetails): AdminProduct {
  const variants = details.variants.filter((variant) => variant.productId === row.id);
  return {
    id: row.id,
    title: row.title,
    handle: row.handle,
    description: row.description,
    status: row.status,
    vendor: row.vendor,
    productType: row.productType,
    tags: row.tags,
    mediaIds: row.mediaIds,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    options: row.options,
    variants: variants.map((variant) => {
      const stock = details.stock.get(variant.id);
      return {
        id: variant.id,
        title: variant.title,
        optionValues: variant.optionValues,
        sku: variant.sku,
        barcode: variant.barcode,
        weightGrams: variant.weightGrams,
        inventoryTracked: variant.inventoryTracked,
        prices: details.prices
          .filter((price) => price.variantId === variant.id)
          .map((price) => ({
            currency: price.currency,
            amount: price.amount,
            compareAtAmount: price.compareAtAmount,
          })),
        stock: stock?.levels ?? [],
        available: variant.inventoryTracked ? (stock?.available ?? 0) : null,
        held: stock?.held ?? 0,
      };
    }),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function describeAdminProductSummary(
  row: ProductRow,
  details: ProductDetails,
  primaryCurrency: string | null,
): AdminProductSummary {
  const variants = details.variants.filter((variant) => variant.productId === row.id);
  const tracked = variants.filter((variant) => variant.inventoryTracked);
  const amounts = details.prices
    .filter(
      (price) =>
        price.currency === primaryCurrency &&
        variants.some((variant) => variant.id === price.variantId),
    )
    .map((price) => price.amount);
  return {
    id: row.id,
    title: row.title,
    handle: row.handle,
    status: row.status,
    imageId: row.mediaIds[0] ?? null,
    variantCount: variants.length,
    available:
      tracked.length === 0
        ? null
        : tracked.reduce(
            (sum, variant) => sum + (details.stock.get(variant.id)?.available ?? 0),
            0,
          ),
    priceRange:
      primaryCurrency && amounts.length > 0
        ? { currency: primaryCurrency, min: Math.min(...amounts), max: Math.max(...amounts) }
        : null,
    updatedAt: row.updatedAt.toISOString(),
  };
}
