import { z } from "zod";
import { countryCodeSchema } from "../money/currencies.js";

/** Every storefront read takes `?country=` to choose the market; without it, the primary one. */
export const storefrontListQuerySchema = z.object({
  country: countryCodeSchema.optional(),
  collection: z.string().trim().max(80).optional(),
  page: z.coerce.number({ error: "The page should be a number" }).int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(24),
});

export const storefrontItemQuerySchema = z.object({ country: countryCodeSchema.optional() });

export const storefrontHandleParamsSchema = z.object({
  handle: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .max(80),
});

const moneySchema = z.object({ amount: z.number().int(), currency: z.string() });
const imageSchema = z.object({
  id: z.string(),
  url: z.string(),
  alt: z.string(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  focalPoint: z.object({ x: z.number(), y: z.number() }).nullable(),
});

export const storefrontProductSchema = z.object({
  id: z.uuid(),
  handle: z.string(),
  title: z.string(),
  descriptionHtml: z.string(),
  vendor: z.string(),
  productType: z.string(),
  tags: z.array(z.string()),
  seo: z.object({ title: z.string(), description: z.string() }),
  images: z.array(imageSchema),
  options: z.array(z.object({ name: z.string(), values: z.array(z.string()) })),
  priceRange: z.object({ min: moneySchema, max: moneySchema }).nullable(),
  availableForSale: z.boolean(),
  /** The shop can't take orders yet (no payments or delivery), so nothing is for sale. */
  comingSoon: z.boolean(),
  variants: z.array(
    z.object({
      id: z.uuid(),
      title: z.string(),
      optionValues: z.array(z.string()),
      sku: z.string().nullable(),
      price: moneySchema.nullable(),
      compareAtPrice: moneySchema.nullable(),
      availableForSale: z.boolean(),
      weightGrams: z.number().int(),
    }),
  ),
});

export const storefrontMarketSchema = z.object({
  handle: z.string(),
  name: z.string(),
  currency: z.string(),
  countries: z.array(z.string()),
  /** The market's countries a shipping zone with a rate covers: where checkout can deliver. */
  deliveryCountries: z.array(z.string()),
  pricesIncludeTax: z.boolean(),
});

export type StorefrontListQuery = z.infer<typeof storefrontListQuerySchema>;
export type StorefrontProduct = z.infer<typeof storefrontProductSchema>;
export type StorefrontMarket = z.infer<typeof storefrontMarketSchema>;
