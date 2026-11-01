import { z } from "zod";
import { emailSchema, newPasswordSchema, userNameSchema } from "../users/users.schema.js";

export const createInvitationRequestSchema = z.object({
  email: emailSchema,
  roleId: z.uuid({ error: "Please choose a role" }),
});

export const invitationIdParamsSchema = z.object({ id: z.uuid() });

export const invitationTokenRequestSchema = z.object({
  token: z.string({ error: "The invitation link is missing its code" }).min(1).max(200),
});

export const acceptInvitationRequestSchema = invitationTokenRequestSchema.extend({
  name: userNameSchema,
  password: newPasswordSchema,
});

export const invitationResponseSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  role: z.object({ id: z.uuid(), name: z.string() }),
  invitedBy: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  createdAt: z.string(),
  expiresAt: z.string(),
  expired: z.boolean(),
});

/** What the accept screen shows before someone chooses their name and password. */
export const invitationPreviewSchema = z.object({
  email: z.string(),
  roleName: z.string(),
  invitedByName: z.string().nullable(),
});

export type CreateInvitationRequest = z.infer<typeof createInvitationRequestSchema>;
export type AcceptInvitationRequest = z.infer<typeof acceptInvitationRequestSchema>;
export type InvitationResponse = z.infer<typeof invitationResponseSchema>;
export type InvitationPreview = z.infer<typeof invitationPreviewSchema>;
