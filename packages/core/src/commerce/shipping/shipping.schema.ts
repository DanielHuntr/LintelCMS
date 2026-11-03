import { z } from "zod";
import { countryCodeSchema, currencyCodeSchema } from "../money/currencies.js";
import { minorAmountSchema } from "../money/money.js";
import { shippingRateKinds } from "./shipping.table.js";

/** `{ "GBP": 495 }`: amounts in minor units, by currency code. */
const amountsSchema = z.record(currencyCodeSchema, minorAmountSchema, {
  error: 'Amounts should be listed by currency, like { "GBP": 495 }',
});

const zoneFields = {
  name: z
    .string({ error: "Please give the zone a name" })
    .trim()
    .min(1, { error: "Please give the zone a name, like Europe" })
    .max(100),
  countries: z
    .array(countryCodeSchema)
    .max(250)
    .transform((countries) => [...new Set(countries)]),
};

export const createShippingZoneRequestSchema = z.object({
  name: zoneFields.name,
  countries: zoneFields.countries.default([]),
});

export const updateShippingZoneRequestSchema = z.object({
  name: zoneFields.name.optional(),
  countries: zoneFields.countries.optional(),
});

const weightBracketSchema = z.object({
  upToGrams: z
    .number()
    .int()
    .positive({ error: "Weight limits should be more than 0 grams" })
    .nullable(),
  amounts: amountsSchema.default({}),
});

const rateFields = {
  name: z
    .string({ error: "Please give the rate a name" })
    .trim()
    .min(1, { error: "Please give the rate a name, like Standard" })
    .max(100),
  kind: z.enum(shippingRateKinds, { error: "The rate should be flat or weight" }),
  amounts: amountsSchema,
  weightBrackets: z.array(weightBracketSchema).max(50),
  freeOverAmounts: amountsSchema.nullable(),
  deliveryEstimate: z.string().trim().max(100),
};

// Defaults belong to creating a rate only. On the update schema they filled in every field
// left out, so renaming a rate wiped its price, weight steps and delivery estimate
// (LINTEL-DATA-014).

const rateRules = <
  Schema extends z.ZodType<{ kind?: string; weightBrackets?: Array<{ upToGrams: number | null }> }>,
>(
  schema: Schema,
) =>
  schema.refine(
    (rate) => {
      if (rate.kind !== "weight" || !rate.weightBrackets) return true;
      const limits = rate.weightBrackets.map((bracket) => bracket.upToGrams);
      // Ascending limits, with only the last allowed to be open-ended.
      return limits.every(
        (limit, index) =>
          (limit === null ? index === limits.length - 1 : true) &&
          (index === 0 || (limit ?? Infinity) > (limits[index - 1] ?? 0)),
      );
    },
    { error: "Weight steps should go up in order, and only the last one can have no limit" },
  );

export const createShippingRateRequestSchema = rateRules(
  z.object({
    name: rateFields.name,
    kind: rateFields.kind.default("flat"),
    amounts: rateFields.amounts.default({}),
    weightBrackets: rateFields.weightBrackets.default([]),
    freeOverAmounts: rateFields.freeOverAmounts.default(null),
    deliveryEstimate: rateFields.deliveryEstimate.default(""),
  }),
);

export const updateShippingRateRequestSchema = rateRules(
  z.object({
    name: rateFields.name.optional(),
    kind: rateFields.kind.optional(),
    amounts: rateFields.amounts.optional(),
    weightBrackets: rateFields.weightBrackets.optional(),
    freeOverAmounts: rateFields.freeOverAmounts.optional(),
    deliveryEstimate: rateFields.deliveryEstimate.optional(),
  }),
);

export type CreateShippingZoneRequest = z.infer<typeof createShippingZoneRequestSchema>;
export type UpdateShippingZoneRequest = z.infer<typeof updateShippingZoneRequestSchema>;
export type CreateShippingRateRequest = z.infer<typeof createShippingRateRequestSchema>;
export type UpdateShippingRateRequest = z.infer<typeof updateShippingRateRequestSchema>;
