import { z } from "zod";

/** One fieldtype as `GET /fieldtypes` lists it, for the blueprint builder. */
export const fieldtypeSummarySchema = z.object({
  type: z.string(),
  name: z.string(),
  description: z.string(),
  /** The plugin that adds it, or null for Lintel's own. */
  plugin: z.string().nullable(),
});

export const fieldtypeListSchema = z.object({ fieldtypes: z.array(fieldtypeSummarySchema) });

export type FieldtypeSummary = z.infer<typeof fieldtypeSummarySchema>;
export type FieldtypeList = z.infer<typeof fieldtypeListSchema>;
