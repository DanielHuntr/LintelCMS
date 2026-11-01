import { z } from "zod";

export const twoFactorCodeSchema = z
  .string({ error: "Please enter the 6-digit code" })
  .trim()
  .min(1, { error: "Please enter the 6-digit code" })
  .max(20);

export const confirmTwoFactorRequestSchema = z.object({ code: twoFactorCodeSchema });

export const passwordConfirmationSchema = z.object({
  password: z
    .string({ error: "Please enter your password" })
    .min(1, { error: "Please enter your password" })
    .max(1000),
});

export const twoFactorStatusSchema = z.object({
  enabled: z.boolean(),
  /** One of their roles asks for it, so it can't be turned off. */
  required: z.boolean(),
  recoveryCodesLeft: z.number().int(),
});

export type TwoFactorStatus = z.infer<typeof twoFactorStatusSchema>;
