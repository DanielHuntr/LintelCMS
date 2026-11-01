import { blocksFieldtype } from "./blocks-fieldtype.js";
import { formFieldtype } from "../forms/form-fieldtype.js";
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
  formFieldtype,
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
