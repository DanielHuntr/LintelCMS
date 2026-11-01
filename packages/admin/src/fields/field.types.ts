/**
 * The shapes of blueprint fields and the values they store, exactly as the content API
 * sends them (see "Fieldtypes" in the phase 1 API contract).
 */

export type FieldType =
  "text" | "textarea" | "richText" | "number" | "toggle" | "select" | "date" | "image" | "link";

export interface SelectChoice {
  value: string;
  label: string;
}

/** Every option any fieldtype can have. Each type reads only the ones that apply to it. */
export interface FieldOptions {
  /** text, textarea */
  maxLength?: number;
  /** number */
  min?: number;
  max?: number;
  step?: number;
  /** select */
  choices?: SelectChoice[];
  multiple?: boolean;
  /** date */
  includeTime?: boolean;
}

export interface Field {
  handle: string;
  label: string;
  type: FieldType;
  required: boolean;
  helpText?: string;
  options: FieldOptions;
}

/** A TipTap (ProseMirror) document, stored as JSON. */
export interface RichTextDocument {
  type: "doc";
  content?: RichTextNode[];
}

export interface RichTextNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: RichTextNode[];
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  text?: string;
}

export interface LinkValue {
  url: string;
  label?: string;
}

/**
 * What an entry's `data` holds for one field. `null` means "deliberately empty": the editor
 * sends it when someone clears an optional field, so the value is removed on save.
 */
export type FieldValue = string | string[] | number | boolean | RichTextDocument | LinkValue | null;

/** An entry's data: field handle to value. Values arrive from the API untyped. */
export type EntryData = Record<string, unknown>;

/** The title field every entry blueprint starts with. It can be relabelled but not removed. */
export const titleFieldHandle = "title";
