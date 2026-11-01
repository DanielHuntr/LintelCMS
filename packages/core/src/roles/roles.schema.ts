import { z } from "zod";

const roleNameSchema = z
  .string({ error: "Please give the role a name" })
  .trim()
  .min(1, { error: "Please give the role a name" })
  .max(60, { error: "Role names can be at most 60 characters" });

const roleDescriptionSchema = z
  .string()
  .trim()
  .max(200, { error: "Descriptions can be at most 200 characters" });

export const createRoleRequestSchema = z.object({
  name: roleNameSchema,
  description: roleDescriptionSchema.default(""),
  permissions: z.array(z.string()).max(200).default([]),
  requiresTwoFactor: z.boolean().default(false),
});

export const updateRoleRequestSchema = z.object({
  name: roleNameSchema.optional(),
  description: roleDescriptionSchema.optional(),
  permissions: z.array(z.string()).max(200).optional(),
  requiresTwoFactor: z.boolean().optional(),
});

export const roleIdParamsSchema = z.object({ id: z.uuid() });

export const roleResponseSchema = z.object({
  id: z.uuid(),
  handle: z.string(),
  name: z.string(),
  description: z.string(),
  isBuiltIn: z.boolean(),
  requiresTwoFactor: z.boolean(),
  permissions: z.array(z.string()),
  memberCount: z.number().int(),
});

export type CreateRoleRequest = z.infer<typeof createRoleRequestSchema>;
export type UpdateRoleRequest = z.infer<typeof updateRoleRequestSchema>;
export type RoleResponse = z.infer<typeof roleResponseSchema>;
