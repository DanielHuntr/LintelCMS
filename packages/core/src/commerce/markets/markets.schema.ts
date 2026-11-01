import { z } from "zod";
import { countryCodeSchema, currencyCodeSchema } from "../money/currencies.js";
import { priceRoundingRules } from "../money/price-conversion.js";

const countryListSchema = z
  .array(countryCodeSchema, { error: "Please send a list of country codes, like GB or US" })
  .transform((countries) => [...new Set(countries)]);

const marketFields = {
  name: z
    .string({ error: "Please give the market a name" })
    .trim()
    .min(1, { error: "Please give the market a name" })
    .max(100, { error: "Market names can be at most 100 characters" }),
  currency: currencyCodeSchema,
  countries: countryListSchema,
  exchangeRate: z
    .number({ error: "The exchange rate should be a number, like 1.17" })
    .positive({ error: "The exchange rate should be more than 0" })
    .max(1_000_000, { error: "That exchange rate is too large" }),
  priceRounding: z.enum(priceRoundingRules, {
    error: `Rounding should be one of: ${priceRoundingRules.join(", ")}`,
  }),
  pricesIncludeTax: z.boolean({ error: "pricesIncludeTax should be true or false" }),
};

/** `POST /shop/markets`. The first market made becomes the primary one. */
export const createMarketRequestSchema = z.object({
  name: marketFields.name,
  currency: marketFields.currency,
  countries: marketFields.countries.default([]),
  exchangeRate: marketFields.exchangeRate.default(1),
  priceRounding: marketFields.priceRounding.default("exact"),
  pricesIncludeTax: marketFields.pricesIncludeTax.default(true),
});

/** `PATCH /shop/markets/:id`. `isPrimary: true` makes this the shop's main market. */
export const updateMarketRequestSchema = z.object({
  name: marketFields.name.optional(),
  currency: marketFields.currency.optional(),
  countries: marketFields.countries.optional(),
  exchangeRate: marketFields.exchangeRate.optional(),
  priceRounding: marketFields.priceRounding.optional(),
  pricesIncludeTax: marketFields.pricesIncludeTax.optional(),
  isPrimary: z.literal(true, { error: "Only isPrimary: true can be sent" }).optional(),
});

export const marketSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  handle: z.string(),
  currency: z.string(),
  countries: z.array(z.string()),
  isPrimary: z.boolean(),
  exchangeRate: z.number(),
  priceRounding: z.enum(priceRoundingRules),
  pricesIncludeTax: z.boolean(),
});

export type CreateMarketRequest = z.infer<typeof createMarketRequestSchema>;
export type UpdateMarketRequest = z.infer<typeof updateMarketRequestSchema>;
export type Market = z.infer<typeof marketSchema>;
