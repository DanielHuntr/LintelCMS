import { z } from "zod";
import { fieldtypeCategories } from "./fieldtype.js";

/** One fieldtype as `GET /fieldtypes` lists it, for the blueprint builder. */
export const fieldtypeSummarySchema = z.object({
  type: z.string(),
  name: z.string(),
  description: z.string(),
  /** Where "Add a field" lists it. */
  category: z.enum(fieldtypeCategories),
  /** Other words people search for it by. */
  keywords: z.array(z.string()),
  /** False for fields that only arrange the editor (a section heading, a spacer, a tab). */
  holdsValue: z.boolean(),
  /** False for fieldtypes that can't go inside a group, repeater or block. */
  canBeInside: z.boolean(),
  /** The plugin that adds it, or null for Lintel's own. */
  plugin: z.string().nullable(),
});

export const fieldtypeListSchema = z.object({ fieldtypes: z.array(fieldtypeSummarySchema) });

export type FieldtypeSummary = z.infer<typeof fieldtypeSummarySchema>;
export type FieldtypeList = z.infer<typeof fieldtypeListSchema>;
