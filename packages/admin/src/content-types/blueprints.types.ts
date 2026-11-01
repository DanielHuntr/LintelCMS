import type { Field, FieldType } from "../fields/field.types.js";

/** A content type: the fields an entry has. Matches the API's `Blueprint`. */
export interface Blueprint {
  id: string;
  handle: string;
  name: string;
  kind: "entry";
  fields: Field[];
  version: number;
  updatedAt: string;
}

/** One row of `GET /fieldtypes`: a fieldtype described in plain words for the builder. */
export interface FieldtypeDescription {
  type: FieldType;
  name: string;
  description: string;
  /** Where "Add a field" lists it. */
  category: FieldtypeCategory;
  /** Other words people search for it by: "dropdown" finds Select. */
  keywords: string[];
  /** False for fields that only arrange the editor (a section heading, a spacer, a tab). */
  holdsValue: boolean;
  /** False for fieldtypes that can't go inside a group, repeater or block. */
  canBeInside: boolean;
}

/** The groups "Add a field" sorts fieldtypes into, in the order it shows them. */
export const fieldtypeCategories = [
  "text",
  "choices",
  "dates",
  "media",
  "relationships",
  "structure",
  "layout",
  "advanced",
] as const;

export type FieldtypeCategory = (typeof fieldtypeCategories)[number];
