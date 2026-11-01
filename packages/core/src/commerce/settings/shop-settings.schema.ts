import { z } from "zod";

/** `PATCH /shop/settings`. Anything left out stays as it is. */
export const updateShopSettingsRequestSchema = z.object({
  shopName: z
    .string({ error: "The shop's name should be text" })
    .trim()
    .max(100, { error: "The shop's name can be at most 100 characters" })
    .optional(),
  supportEmail: z
    .union([
      z.literal(""),
      z.email({ error: "Please enter an email address, like help@example.com" }),
    ])
    .optional(),
  orderNumberPrefix: z
    .string({ error: "The order number prefix should be text" })
    .trim()
    .max(10, { error: "The order number prefix can be at most 10 characters" })
    .optional(),
});

export type UpdateShopSettingsRequest = z.infer<typeof updateShopSettingsRequestSchema>;

export const shopSettingsSchema = z.object({
  shopName: z.string(),
  supportEmail: z.string(),
  orderNumberPrefix: z.string(),
  nextOrderNumber: z.number().int(),
});

export type ShopSettings = z.infer<typeof shopSettingsSchema>;
