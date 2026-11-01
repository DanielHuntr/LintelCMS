import { z } from "zod";
import { fieldSchema } from "../blueprints/blueprints.schema.js";
import { handleSchema } from "../http/handle.schema.js";

/** Fields are sent as a plain list and checked one by one, so problems come back per field. */
const fieldListSchema = z.array(z.unknown(), { error: "Please send the fields as a list" });

const globalSetNameSchema = z
  .string({ error: "Please give the global set a name" })
  .trim()
  .min(1, { error: "Please give the global set a name" })
  .max(100, { error: "Names can be at most 100 characters" });

/** `POST /globals` */
export const createGlobalSetRequestSchema = z.object({
  handle: handleSchema("Please give the global set a handle"),
  name: globalSetNameSchema,
  fields: fieldListSchema.default([]),
});

/** `PUT /globals/:handle`: its name and fields. The handle can't change: sites read by it. */
export const updateGlobalSetRequestSchema = z.object({
  name: globalSetNameSchema,
  fields: fieldListSchema,
});

/** `PATCH /globals/:handle/values`. Merged over the saved values, like an entry's. */
export const saveGlobalValuesRequestSchema = z.object({
  data: z.record(z.string(), z.unknown(), {
    error: "Please send the field values as an object, keyed by field handle",
  }),
});

export const globalSetParamsSchema = z.object({ handle: z.string() });

/** A global set in a list. */
export const globalSetSummarySchema = z.object({
  id: z.uuid(),
  handle: z.string(),
  name: z.string(),
  fieldCount: z.number().int(),
  updatedAt: z.iso.datetime(),
});

/** A global set with its fields and its values in one language. */
export const globalSetSchema = globalSetSummarySchema.extend({
  fields: z.array(fieldSchema),
  locale: z.string(),
  data: z.record(z.string(), z.unknown()),
  /** False while this language has nothing saved of its own and shows the default's values. */
  hasOwnValues: z.boolean(),
});

/** `GET /delivery/globals/:handle` */
export const deliveredGlobalSetSchema = z.object({
  handle: z.string(),
  name: z.string(),
  locale: z.string(),
  data: z.record(z.string(), z.unknown()),
});

export type CreateGlobalSetRequest = z.infer<typeof createGlobalSetRequestSchema>;
export type UpdateGlobalSetRequest = z.infer<typeof updateGlobalSetRequestSchema>;
export type SaveGlobalValuesRequest = z.infer<typeof saveGlobalValuesRequestSchema>;
export type GlobalSetSummaryResponse = z.infer<typeof globalSetSummarySchema>;
export type GlobalSetResponse = z.infer<typeof globalSetSchema>;
export type DeliveredGlobalSet = z.infer<typeof deliveredGlobalSetSchema>;
