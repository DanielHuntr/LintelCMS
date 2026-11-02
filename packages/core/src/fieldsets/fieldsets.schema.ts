import { z } from "zod";
import { fieldSchema } from "../blueprints/blueprints.schema.js";
import { handleSchema } from "../http/handle.schema.js";

/** Fields are sent as a plain list and checked one by one, so problems come back per field. */
const fieldListSchema = z.array(z.unknown(), { error: "Please send the fields as a list" });

const fieldsetNameSchema = z
  .string({ error: "Please give the fieldset a name" })
  .trim()
  .min(1, { error: "Please give the fieldset a name" })
  .max(100, { error: "Names can be at most 100 characters" });

/** `POST /fieldsets` */
export const createFieldsetRequestSchema = z.object({
  handle: handleSchema("Please give the fieldset a handle"),
  name: fieldsetNameSchema,
  fields: fieldListSchema.default([]),
});

/** `PUT /fieldsets/:handle`. The handle can't change: Fieldset fields refer to it. */
export const updateFieldsetRequestSchema = z.object({
  name: fieldsetNameSchema,
  fields: fieldListSchema,
  /** Handles changed in this save; entries' values move to the new handles. */
  renames: z
    .array(z.object({ from: z.string(), to: z.string() }))
    .max(200)
    .optional(),
});

export const fieldsetParamsSchema = z.object({ handle: z.string() });

export const fieldsetSchema = z.object({
  id: z.uuid(),
  handle: z.string(),
  name: z.string(),
  fields: z.array(fieldSchema),
  /** The content types and global sets that use it, by name. */
  usedBy: z.array(z.string()),
  updatedAt: z.iso.datetime(),
});

export type CreateFieldsetRequest = z.infer<typeof createFieldsetRequestSchema>;
export type UpdateFieldsetRequest = z.infer<typeof updateFieldsetRequestSchema>;
export type FieldsetResponse = z.infer<typeof fieldsetSchema>;
