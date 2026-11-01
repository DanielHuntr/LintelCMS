import { z } from "zod";
import { fieldSettingsShape } from "../fieldtypes/field-settings.schema.js";
import { handleSchema } from "../http/handle.schema.js";

/**
 * Requests carry `fields` as a plain list here; each field is checked by
 * blueprint-fields.ts instead, so problems come back per field in `fields`.
 */
const fieldListSchema = z.array(z.unknown(), { error: "Please send the fields as a list" });

const blueprintNameSchema = z
  .string({ error: "Please give the content type a name" })
  .trim()
  .min(1, { error: "Please give the content type a name" })
  .max(100, { error: "Names can be at most 100 characters" });

/** `POST /blueprints` */
export const createBlueprintRequestSchema = z.object({
  handle: handleSchema("Please give the content type a handle"),
  name: blueprintNameSchema,
  fields: fieldListSchema,
});

/** `PUT /blueprints/:handle`. The handle can't change: collections and code refer to it. */
export const updateBlueprintRequestSchema = z.object({
  name: blueprintNameSchema,
  fields: fieldListSchema,
});

export const blueprintHandleParamsSchema = z.object({ handle: z.string() });

/**
 * A field as the API returns it; the same shape the blueprint builder sends. The shared
 * settings (width, conditions, validation...) are there only when they aren't the default.
 */
export const fieldSchema = z.object({
  handle: z.string(),
  label: z.string(),
  type: z.string(),
  required: z.boolean(),
  helpText: z.string(),
  options: z.record(z.string(), z.unknown()),
  ...fieldSettingsShape,
});

/** A blueprint as the API returns it. */
export const blueprintSchema = z.object({
  id: z.uuid(),
  handle: z.string(),
  name: z.string(),
  kind: z.literal("entry"),
  fields: z.array(fieldSchema),
  version: z.number().int(),
  updatedAt: z.iso.datetime(),
});

export type CreateBlueprintRequest = z.infer<typeof createBlueprintRequestSchema>;
export type UpdateBlueprintRequest = z.infer<typeof updateBlueprintRequestSchema>;
export type BlueprintResponse = z.infer<typeof blueprintSchema>;
