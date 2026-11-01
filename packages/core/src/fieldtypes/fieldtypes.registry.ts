import { blocksFieldtype } from "./blocks-fieldtype.js";
import type { Fieldtype } from "./fieldtype.js";
import {
  colourFieldtype,
  emailFieldtype,
  markdownFieldtype,
  urlFieldtype,
} from "./format-fieldtypes.js";
import { listFieldtype } from "./list-fieldtype.js";
import { pageFieldtype } from "./page-fieldtype.js";
import { imageFieldtype, linkFieldtype, selectFieldtype } from "./reference-fieldtypes.js";
import { entriesFieldtype, termsFieldtype } from "./relation-fieldtypes.js";
import { richTextFieldtype, textareaFieldtype, textFieldtype } from "./text-fieldtypes.js";
import { dateFieldtype, numberFieldtype, toggleFieldtype } from "./value-fieldtypes.js";

/**
 * Every fieldtype, in one visible list and in the order the blueprint builder shows them.
 * To add one, define it next to its relatives and add it here; nothing is discovered.
 */
export const fieldtypeRegistry: readonly Fieldtype[] = [
  textFieldtype,
  textareaFieldtype,
  richTextFieldtype,
  numberFieldtype,
  toggleFieldtype,
  selectFieldtype,
  dateFieldtype,
  imageFieldtype,
  linkFieldtype,
  emailFieldtype,
  urlFieldtype,
  colourFieldtype,
  markdownFieldtype,
  listFieldtype,
  entriesFieldtype,
  termsFieldtype,
  blocksFieldtype,
  pageFieldtype,
];

export const fieldtypeNames = fieldtypeRegistry.map((fieldtype) => fieldtype.type);

export function findFieldtype(type: string): Fieldtype | undefined {
  return fieldtypeRegistry.find((fieldtype) => fieldtype.type === type);
}
