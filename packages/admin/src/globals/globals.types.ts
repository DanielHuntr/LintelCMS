import type { Field } from "../fields/field.types.js";

/** A global set in a list. Matches the API's `GlobalSetSummary`. */
export interface GlobalSetSummary {
  id: string;
  handle: string;
  name: string;
  fieldCount: number;
  updatedAt: string;
}

/** A global set with its fields and its values in one language. */
export interface GlobalSet extends GlobalSetSummary {
  fields: Field[];
  locale: string;
  data: Record<string, unknown>;
  /** False while this language shows the main language's values. */
  hasOwnValues: boolean;
}
