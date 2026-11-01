import { z } from "zod";
import { emailSchema, newPasswordSchema, userNameSchema } from "../users/users.schema.js";

export const updateProfileRequestSchema = z.object({
  name: userNameSchema.optional(),
  /** A picture from the media library, or null to remove it. */
  avatarAssetId: z.uuid().nullable().optional(),
});

const currentPasswordSchema = z
  .string({ error: "Please enter your current password" })
  .min(1, { error: "Please enter your current password" })
  .max(1000);

export const changeEmailRequestSchema = z.object({
  newEmail: emailSchema,
  password: currentPasswordSchema,
});

export const confirmEmailRequestSchema = z.object({
  token: z.string({ error: "The link is missing its code" }).min(1).max(200),
});

export const changePasswordRequestSchema = z.object({
  currentPassword: currentPasswordSchema,
  newPassword: newPasswordSchema,
});

export const sessionIdParamsSchema = z.object({ id: z.uuid() });

export const accountResponseSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  name: z.string(),
  avatar: z.object({ id: z.uuid(), url: z.string() }).nullable(),
  /** An address waiting to be confirmed from its inbox. */
  pendingEmail: z.string().nullable(),
  roles: z.array(z.object({ id: z.uuid(), name: z.string() })),
});

export const accountSessionSchema = z.object({
  id: z.uuid(),
  browser: z.string(),
  createdAt: z.string(),
  lastUsedAt: z.string(),
  current: z.boolean(),
});

export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;
export type ChangeEmailRequest = z.infer<typeof changeEmailRequestSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;
export type AccountResponse = z.infer<typeof accountResponseSchema>;
export type AccountSession = z.infer<typeof accountSessionSchema>;
