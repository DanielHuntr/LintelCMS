import { blocksFieldtype } from "./blocks-fieldtype.js";
import { buttonGroupFieldtype, checkboxesFieldtype, radioFieldtype } from "./choice-fieldtypes.js";
import { fieldsetFieldtype, groupFieldtype, repeaterFieldtype } from "./container-fieldtypes.js";
import { formFieldtype } from "../forms/form-fieldtype.js";
import type { Fieldtype } from "./fieldtype.js";
import {
  colourFieldtype,
  emailFieldtype,
  markdownFieldtype,
  urlFieldtype,
} from "./format-fieldtypes.js";
import {
  revealerFieldtype,
  sectionFieldtype,
  spacerFieldtype,
  tabFieldtype,
} from "./layout-fieldtypes.js";
import { listFieldtype } from "./list-fieldtype.js";
import { rangeFieldtype, timeFieldtype } from "./measure-fieldtypes.js";
import { iconFieldtype, videoFieldtype } from "./media-fieldtypes.js";
import { pageFieldtype } from "./page-fieldtype.js";
import { imageFieldtype, linkFieldtype, selectFieldtype } from "./reference-fieldtypes.js";
import { entriesFieldtype, termsFieldtype, usersFieldtype } from "./relation-fieldtypes.js";
import { tableFieldtype } from "./table-fieldtype.js";
import { richTextFieldtype, textareaFieldtype, textFieldtype } from "./text-fieldtypes.js";
import { dateFieldtype, numberFieldtype, toggleFieldtype } from "./value-fieldtypes.js";
import { codeFieldtype, hiddenFieldtype, slugFieldtype } from "./writing-fieldtypes.js";

/**
 * Every fieldtype, in one visible list and in the order the blueprint builder shows them
 * within each category. To add one, define it next to its relatives and add it here;
 * nothing is discovered.
 */
export const fieldtypeRegistry: readonly Fieldtype[] = [
  // Text and writing
  textFieldtype,
  textareaFieldtype,
  richTextFieldtype,
  markdownFieldtype,
  slugFieldtype,
  // Numbers and choices
  numberFieldtype,
  rangeFieldtype,
  toggleFieldtype,
  selectFieldtype,
  radioFieldtype,
  checkboxesFieldtype,
  buttonGroupFieldtype,
  // Dates and times
  dateFieldtype,
  timeFieldtype,
  // Media
  imageFieldtype,
  videoFieldtype,
  colourFieldtype,
  iconFieldtype,
  // Links and relationships
  linkFieldtype,
  urlFieldtype,
  emailFieldtype,
  entriesFieldtype,
  termsFieldtype,
  usersFieldtype,
  formFieldtype,
  // Structure and repeating
  listFieldtype,
  tableFieldtype,
  groupFieldtype,
  repeaterFieldtype,
  blocksFieldtype,
  fieldsetFieldtype,
  // Layout and display
  tabFieldtype,
  sectionFieldtype,
  spacerFieldtype,
  revealerFieldtype,
  // Advanced
  codeFieldtype,
  hiddenFieldtype,
  pageFieldtype,
];

/**
 * Fieldtypes added by plugins, keyed by type. Plugins are code installed into the server,
 * so their fieldtypes join the list when the server is built with them (see
 * src/plugins/plugin-catalogue.ts). They stay usable while the plugin is switched off, so
 * content that already uses them can still be saved.
 */
const pluginFieldtypes = new Map<string, { pluginId: string; fieldtype: Fieldtype }>();

export function registerPluginFieldtypes(pluginId: string, fieldtypes: readonly Fieldtype[]): void {
  for (const fieldtype of fieldtypes) {
    const existing = pluginFieldtypes.get(fieldtype.type);
    if (existing && existing.pluginId !== pluginId) {
      throw new Error(
        `The fieldtype "${fieldtype.type}" is added by both "${existing.pluginId}" and "${pluginId}".`,
      );
    }
    pluginFieldtypes.set(fieldtype.type, { pluginId, fieldtype });
  }
}

/** Every fieldtype: the built-in ones, then those from plugins, with the plugin's id. */
export function listAllFieldtypes(): Array<{ fieldtype: Fieldtype; pluginId: string | null }> {
  return [
    ...fieldtypeRegistry.map((fieldtype) => ({ fieldtype, pluginId: null })),
    ...[...pluginFieldtypes.values()],
  ];
}

export function fieldtypeNames(): string[] {
  return listAllFieldtypes().map(({ fieldtype }) => fieldtype.type);
}

export function findFieldtype(type: string): Fieldtype | undefined {
  return (
    fieldtypeRegistry.find((fieldtype) => fieldtype.type === type) ??
    pluginFieldtypes.get(type)?.fieldtype
  );
}
