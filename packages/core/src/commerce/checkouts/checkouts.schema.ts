import { z } from "zod";
import { checkoutModes } from "../settings/shop-settings.table.js";
import { checkoutStatuses } from "./checkouts.table.js";

const pageUrlSchema = (label: string) =>
  z
    .string({ error: `Please send the ${label}` })
    .max(2000)
    .refine(
      (value) => {
        try {
          const url = new URL(value);
          return url.protocol === "https:" || url.protocol === "http:";
        } catch {
          return false;
        }
      },
      { error: `The ${label} should be a full address, like https://example.com/thanks` },
    );

/**
 * `POST /delivery/shop/carts/:token/checkout`. Where Stripe's payment page sends the shopper
 * back to; only needed for the hosted checkout.
 */
export const startCheckoutRequestSchema = z
  .object({
    successUrl: pageUrlSchema("success page address").optional(),
    cancelUrl: pageUrlSchema("cancel page address").optional(),
  })
  .default({});

export type StartCheckoutRequest = z.infer<typeof startCheckoutRequestSchema>;

const moneySchema = z.object({ amount: z.number().int(), currency: z.string() });

export const startedCheckoutSchema = z.object({
  checkoutId: z.uuid(),
  mode: z.enum(checkoutModes),
  /** Hosted: send the shopper here. */
  url: z.string().nullable(),
  /** Embedded: give this and the publishable key to Stripe's Payment Element. */
  clientSecret: z.string().nullable(),
  publishableKey: z.string().nullable(),
  expiresAt: z.iso.datetime(),
  subtotal: moneySchema,
  discount: moneySchema,
  shipping: moneySchema,
  tax: moneySchema,
  total: moneySchema,
  taxesIncluded: z.boolean(),
});

/** `GET /delivery/shop/checkouts/:id`, for the "Thank you" page to poll. */
export const checkoutStatusSchema = z.object({
  checkoutId: z.uuid(),
  status: z.enum(checkoutStatuses),
  /** "#1001" once the payment has arrived and the order exists. */
  orderName: z.string().nullable(),
  total: moneySchema,
});

export type StartedCheckout = z.infer<typeof startedCheckoutSchema>;
export type CheckoutStatusResponse = z.infer<typeof checkoutStatusSchema>;
