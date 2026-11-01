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
}
