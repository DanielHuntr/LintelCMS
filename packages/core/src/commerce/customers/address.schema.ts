import { z } from "zod";
import { countryCodeSchema } from "../money/currencies.js";

const line = (label: string, max = 200) =>
  z
    .string({ error: `${label} should be text` })
    .trim()
    .max(max, { error: `${label} can be at most ${max} characters` });

/**
 * A postal address, as customers type it. Kept loose on purpose: postcodes and regions work
 * differently in every country, so only the country is checked strictly.
 */
export const addressSchema = z.object({
  name: line("The name").min(1, { error: "Please enter the name to deliver to" }),
  company: line("The company").default(""),
  line1: line("The first address line").min(1, { error: "Please enter the street address" }),
  line2: line("The second address line").default(""),
  city: line("The town or city").min(1, { error: "Please enter the town or city" }),
  region: line("The region").default(""),
  postalCode: line("The postcode", 20).default(""),
  country: countryCodeSchema,
  phone: line("The phone number", 40).default(""),
});

export type Address = z.infer<typeof addressSchema>;
