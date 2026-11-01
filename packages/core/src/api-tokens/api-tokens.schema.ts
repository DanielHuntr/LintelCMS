import { z } from "zod";

/** "read" sees content; "readWrite" can also change it through the management API. */
export const apiTokenAccessLevels = ["read", "readWrite"] as const;
export type ApiTokenAccess = (typeof apiTokenAccessLevels)[number];

/** `POST /api-tokens` */
export const createApiTokenRequestSchema = z.object({
  name: z
    .string({ error: "Please give the token a name" })
    .trim()
    .min(1, { error: "Please give the token a name, like “Marketing website”" })
    .max(100, { error: "Names can be at most 100 characters" }),
  access: z.enum(apiTokenAccessLevels, { error: 'Access should be "read" or "readWrite"' }),
});

export const apiTokenIdParamsSchema = z.object({ id: z.uuid() });

/** A token as the admin lists it. The token itself is never shown again after it is made. */
export const apiTokenSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  access: z.enum(apiTokenAccessLevels),
  /** The first characters of the token, like "lintel_3fA9", so people can tell them apart. */
  tokenStart: z.string(),
  createdAt: z.iso.datetime(),
  lastUsedAt: z.iso.datetime().nullable(),
  createdBy: z.object({ id: z.uuid(), name: z.string() }).nullable(),
});

export const apiTokenListSchema = z.object({ tokens: z.array(apiTokenSchema) });

/** What `POST /api-tokens` answers: the new token, with its secret shown this once. */
export const createdApiTokenSchema = z.object({
  token: apiTokenSchema,
  secret: z.string(),
});

export type CreateApiTokenRequest = z.infer<typeof createApiTokenRequestSchema>;
export type ApiTokenResponse = z.infer<typeof apiTokenSchema>;
export type CreatedApiToken = z.infer<typeof createdApiTokenSchema>;
