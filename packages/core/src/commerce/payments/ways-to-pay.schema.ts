import { z } from "zod";

/**
 * `GET /shop/settings/ways-to-pay`: what shoppers can pay with, for each connected provider.
 * `methods` is null when the provider can't say: PayPal has no call for it, and any provider
 * can fail to answer. The admin says so rather than guessing.
 */
export const waysToPaySchema = z.object({
  providers: z.array(
    z.object({
      provider: z.enum(["stripe", "paypal", "mollie"]),
      mode: z.enum(["test", "live"]).nullable(),
      methods: z
        .array(
          z.object({
            id: z.string(),
            name: z.string(),
            /** Switched on, but the provider hasn't approved it yet. */
            waiting: z.boolean(),
          }),
        )
        .nullable(),
    }),
  ),
});

export type WaysToPay = z.infer<typeof waysToPaySchema>;
export type WayToPay = NonNullable<WaysToPay["providers"][number]["methods"]>[number];
