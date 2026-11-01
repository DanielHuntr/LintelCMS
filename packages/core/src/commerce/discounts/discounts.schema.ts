import { z } from "zod";
import { currencyCodeSchema } from "../money/currencies.js";
import { minorAmountSchema } from "../money/money.js";
import { discountKinds, discountMethods, discountScopes } from "./discounts.table.js";

const amountsByCurrencySchema = z
  .record(currencyCodeSchema, minorAmountSchema, {
    error: "Amounts should be listed by currency, like { GBP: 1000 }",
  })
  .default({});

const optionalCount = (label: string) =>
  z
    .number({ error: `${label} should be a whole number` })
    .int({ error: `${label} should be a whole number` })
    .min(1, { error: `${label} should be at least 1` })
    .max(1_000_000, { error: `${label} is too large` })
    .nullable()
    .default(null);

/**
 * `POST /shop/discounts` and `PUT /shop/discounts/:id`: the whole discount. Fields that
 * don't apply to its kind are ignored (and saved empty).
 */
export const discountRequestSchema = z
  .object({
    title: z
      .string({ error: "Please give the discount a name" })
      .trim()
      .min(1, { error: "Please give the discount a name, like Summer sale" })
      .max(200, { error: "The name can be at most 200 characters" }),
    method: z.enum(discountMethods, { error: "Choose a code or an automatic discount" }),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9_-]{2,39}$/, {
        error: "Codes are 3 to 40 letters, numbers, hyphens or underscores, like SUMMER20",
      })
      .nullish()
      .transform((value) => value ?? null),
    kind: z.enum(discountKinds, {
      error: `The kind should be one of: ${discountKinds.join(", ")}`,
    }),
    percentOff: z
      .number({ error: "The percentage should be a whole number" })
      .int({ error: "The percentage should be a whole number" })
      .min(1, { error: "The percentage should be at least 1" })
      .max(100, { error: "The percentage can be at most 100" })
      .optional(),
    amounts: amountsByCurrencySchema,
    buyQuantity: z.number().int().min(1).max(100).default(1),
    getQuantity: z.number().int().min(1).max(100).default(1),
    scope: z.enum(discountScopes).default("order"),
    productIds: z.array(z.uuid()).max(500).default([]),
    collectionIds: z.array(z.uuid()).max(100).default([]),
    minimumSpend: amountsByCurrencySchema,
    minimumQuantity: optionalCount("The minimum quantity"),
    startsAt: z.iso.datetime({ error: "The start should be a date and time" }).optional(),
    endsAt: z.iso.datetime({ error: "The end should be a date and time" }).nullable().default(null),
    usageLimit: optionalCount("The usage limit"),
    perCustomerLimit: optionalCount("The limit per customer"),
    combinesWithOthers: z.boolean().default(true),
    enabled: z.boolean().default(true),
  })
  .superRefine((discount, context) => {
    const problem = (path: string, message: string) =>
      context.addIssue({ code: "custom", path: [path], message });
    if (discount.method === "code" && !discount.code) {
      problem("code", "Please enter the code shoppers will type, like SUMMER20");
    }
    if (discount.kind === "percentage" && discount.percentOff === undefined) {
      problem("percentOff", "Please say how much off, as a percentage");
    }
    if (discount.kind === "fixed_amount" && Object.keys(discount.amounts).length === 0) {
      problem("amounts", "Please say how much off, in at least one currency");
    }
    if (discount.scope === "products" && discount.productIds.length === 0) {
      problem("productIds", "Choose at least one product");
    }
    if (discount.scope === "collections" && discount.collectionIds.length === 0) {
      problem("collectionIds", "Choose at least one collection");
    }
    if (discount.endsAt && discount.startsAt && discount.endsAt <= discount.startsAt) {
      problem("endsAt", "The end should be after the start");
    }
  });

export type DiscountRequest = z.infer<typeof discountRequestSchema>;

export const discountStatuses = ["active", "scheduled", "expired", "used_up", "off"] as const;

export const discountSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  method: z.enum(discountMethods),
  code: z.string().nullable(),
  kind: z.enum(discountKinds),
  percentOff: z.number().int(),
  amounts: z.record(z.string(), z.number().int()),
  buyQuantity: z.number().int(),
  getQuantity: z.number().int(),
  scope: z.enum(discountScopes),
  productIds: z.array(z.uuid()),
  collectionIds: z.array(z.uuid()),
  minimumSpend: z.record(z.string(), z.number().int()),
  minimumQuantity: z.number().int().nullable(),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime().nullable(),
  usageLimit: z.number().int().nullable(),
  perCustomerLimit: z.number().int().nullable(),
  combinesWithOthers: z.boolean(),
  enabled: z.boolean(),
  /** What the shop owner sees in the list: on now, starting later, finished, used up, off. */
  status: z.enum(discountStatuses),
  /** Orders placed with it. */
  usageCount: z.number().int(),
  createdAt: z.iso.datetime(),
});

export type DiscountResponse = z.infer<typeof discountSchema>;
