import { z } from "zod";
import { emailSchema, newPasswordSchema } from "../users/users.schema.js";

export const forgotPasswordRequestSchema = z.object({ email: emailSchema });

export const resetTokenRequestSchema = z.object({
  token: z.string({ error: "The reset link is missing its code" }).min(1).max(200),
});

export const resetPasswordRequestSchema = resetTokenRequestSchema.extend({
  newPassword: newPasswordSchema,
});

export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;
