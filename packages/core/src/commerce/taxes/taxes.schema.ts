import { z } from "zod";
import { countryCodeSchema } from "../money/currencies.js";
import { taxCalculations } from "../settings/shop-settings.table.js";

export const updateTaxSettingsRequestSchema = z.object({
  taxCalculation: z
    .enum(taxCalculations, { error: "Tax should be worked out by stripe or manual" })
    .optional(),
  taxShipping: z.boolean({ error: "taxShipping should be true or false" }).optional(),
  manualTaxRates: z
    .array(
      z.object({
        country: countryCodeSchema,
        rate: z
          .number({ error: "Tax rates are percentages, like 20" })
          .min(0, { error: "Tax rates can't be negative" })
          .max(100, { error: "Tax rates can be at most 100%" }),
        name: z.string().trim().max(50).default("Tax"),
      }),
    )
    .max(250)
    .refine((rates) => new Set(rates.map((rate) => rate.country)).size === rates.length, {
      error: "Each country can only have one tax rate",
    })
    .optional(),
});

export type UpdateTaxSettingsRequest = z.infer<typeof updateTaxSettingsRequestSchema>;

export const taxSettingsSchema = z.object({
  taxCalculation: z.enum(taxCalculations),
  taxShipping: z.boolean(),
  manualTaxRates: z.array(z.object({ country: z.string(), rate: z.number(), name: z.string() })),
  /** What will actually be used: Stripe Tax needs Stripe connected first. */
  effectiveCalculation: z.enum(taxCalculations),
});

export type TaxSettings = z.infer<typeof taxSettingsSchema>;
