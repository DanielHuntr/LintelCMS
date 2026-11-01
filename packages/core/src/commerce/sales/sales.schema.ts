import { z } from "zod";

export const salesSummaryQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(366).default(30),
});

const moneySchema = z.object({ amount: z.number().int(), currency: z.string() });

export const salesSummarySchema = z.object({
  days: z.number().int(),
  primaryCurrency: z.string().nullable(),
  byCurrency: z.array(
    z.object({
      currency: z.string(),
      sales: moneySchema,
      orderCount: z.number().int(),
      averageOrder: moneySchema,
    }),
  ),
  daily: z.array(z.object({ date: z.string(), sales: moneySchema, orderCount: z.number().int() })),
  ordersToFulfil: z.number().int(),
});

export type SalesSummary = z.infer<typeof salesSummarySchema>;
