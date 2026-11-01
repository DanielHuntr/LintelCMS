import { z } from "zod";
import {
  collectionRuleFields,
  collectionRuleOperators,
  productCollectionKinds,
} from "./product-collections.table.js";

const ruleSchema = z
  .object({
    field: z.enum(collectionRuleFields, {
      error: `Rules can look at: ${collectionRuleFields.join(", ")}`,
    }),
    operator: z.enum(collectionRuleOperators, {
      error: `Rules can check: ${collectionRuleOperators.join(", ")}`,
    }),
    value: z.string().trim().min(1, { error: "Each rule needs a value" }).max(200),
  })
  .refine(
    (rule) =>
      rule.field === "price"
        ? rule.operator !== "contains" && /^\d+$/.test(rule.value)
        : rule.operator === "equals" || rule.operator === "contains",
    {
      error:
        "Price rules compare a whole amount in minor units (is, greater than, less than); the others check text (is, contains)",
    },
  );

/** `POST /shop/collections` and `PUT /shop/collections/:id`. */
export const productCollectionRequestSchema = z.object({
  title: z
    .string({ error: "Please give the collection a title" })
    .trim()
    .min(1, { error: "Please give the collection a title" })
    .max(200),
  handle: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
      error: "Handles use lowercase letters, numbers and hyphens, like summer-sale",
    })
    .max(80)
    .optional(),
  description: z.string().trim().max(2000).default(""),
  kind: z.enum(productCollectionKinds).default("manual"),
  rules: z.array(ruleSchema).max(20).default([]),
  matchAll: z.boolean().default(true),
  /** Manual collections: the products, in order. Ignored for automatic ones. */
  productIds: z.array(z.uuid()).max(1000).default([]),
});

export type ProductCollectionRequest = z.infer<typeof productCollectionRequestSchema>;

export const productCollectionSummarySchema = z.object({
  id: z.uuid(),
  title: z.string(),
  handle: z.string(),
  description: z.string(),
  kind: z.enum(productCollectionKinds),
  productCount: z.number().int(),
});

export type ProductCollectionSummary = z.infer<typeof productCollectionSummarySchema>;
