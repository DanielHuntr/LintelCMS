import { z } from "zod";
import { addressSchema } from "../customers/address.schema.js";
import { countryCodeSchema } from "../money/currencies.js";

const quantitySchema = z
  .number({ error: "The quantity should be a whole number" })
  .int({ error: "The quantity should be a whole number" })
  .min(0, { error: "The quantity can't be negative" })
  .max(999, { error: "At most 999 of one item can be in a cart" });

/** `POST /delivery/shop/carts`. The country picks the market (and so the currency). */
export const createCartRequestSchema = z
  .object({ country: countryCodeSchema.optional() })
  .default({});

/** `POST /delivery/shop/carts/:token/lines` */
export const addCartLineRequestSchema = z.object({
  variantId: z.uuid({ error: "Please send the variant id to add" }),
  quantity: quantitySchema.min(1, { error: "Add at least one" }).default(1),
});

/** `PATCH /delivery/shop/carts/:token/lines/:lineId`. 0 removes the line. */
export const updateCartLineRequestSchema = z.object({ quantity: quantitySchema });

/** `PATCH /delivery/shop/carts/:token`. Anything left out stays as it is. */
export const updateCartRequestSchema = z.object({
  email: z.email({ error: "Please enter an email address, like name@example.com" }).optional(),
  country: countryCodeSchema.optional(),
  shippingAddress: addressSchema.optional(),
  shippingRateId: z
    .uuid({ error: "Please choose one of the shipping rates offered" })
    .nullable()
    .optional(),
  discountCodes: z.array(z.string().trim().min(1).max(50)).max(5).optional(),
});

export const cartTokenParamsSchema = z.object({
  token: z.string().regex(/^cart_[A-Za-z0-9_-]{20,64}$/),
});

const moneyOutputSchema = z.object({ amount: z.number().int(), currency: z.string() });

export const cartLineSchema = z.object({
  id: z.uuid(),
  variantId: z.uuid(),
  productId: z.uuid().nullable(),
  productTitle: z.string(),
  productHandle: z.string().nullable(),
  variantTitle: z.string(),
  sku: z.string().nullable(),
  image: z.object({ id: z.string(), url: z.string(), alt: z.string() }).nullable(),
  quantity: z.number().int(),
  unitPrice: moneyOutputSchema.nullable(),
  compareAtPrice: moneyOutputSchema.nullable(),
  subtotal: moneyOutputSchema,
  quantityAvailable: z.number().int().nullable(),
  problem: z.enum(["unavailable", "no_price", "out_of_stock", "not_enough_stock"]).nullable(),
});

export const cartSchema = z.object({
  id: z.uuid(),
  market: z.object({
    handle: z.string(),
    name: z.string(),
    currency: z.string(),
    pricesIncludeTax: z.boolean(),
  }),
  country: z.string().nullable(),
  email: z.string().nullable(),
  shippingAddress: addressSchema.nullable(),
  shippingRateId: z.string().nullable(),
  discountCodes: z.array(z.string()),
  lines: z.array(cartLineSchema),
  itemCount: z.number().int(),
  subtotal: moneyOutputSchema,
  discounts: z.array(z.object({ code: z.string(), title: z.string(), amount: moneyOutputSchema })),
  /** The chosen shipping rate's price, once there is an address and a rate. */
  shipping: moneyOutputSchema.nullable(),
  /** Before tax when prices exclude it; tax is worked out at checkout. */
  total: moneyOutputSchema,
  /** True when every line can be bought and email, address and shipping are chosen. */
  readyForCheckout: z.boolean(),
});

export type CreateCartRequest = z.infer<typeof createCartRequestSchema>;
export type AddCartLineRequest = z.infer<typeof addCartLineRequestSchema>;
export type UpdateCartRequest = z.infer<typeof updateCartRequestSchema>;
export type Cart = z.infer<typeof cartSchema>;
export type CartLine = z.infer<typeof cartLineSchema>;
