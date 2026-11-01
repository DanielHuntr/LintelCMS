/**
 * The shapes of blueprint fields and the values they store, exactly as the content API
 * sends them (see "Fieldtypes" in the phase 1 API contract).
 */

export type FieldType =
  | "text"
  | "textarea"
  | "richText"
  | "number"
  | "toggle"
  | "select"
  | "date"
  | "image"
  | "link"
  | "email"
  | "url"
  | "colour"
  | "markdown"
  | "list"
  | "entries"
  | "terms"
  | "blocks";

export interface SelectChoice {
  value: string;
  label: string;
}

/**
 * One kind of block a blocks field offers (Hero, Text...), with its own fields.
 * `draft` is the blueprint builder's bookkeeping and is never sent to the API.
 */
export interface BlockType {
  handle: string;
  name: string;
  description?: string;
  fields: Field[];
  draft?: DraftBookkeeping;
}

/** A stable key for lists, and whether the handle still follows the name or label. */
export interface DraftBookkeeping {
  key: string;
  handleFollows: boolean;
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
  /** colour: colours to offer as one-click choices */
  swatches?: string[];
  /** list, entries, terms: the most that can be added or chosen */
  maxItems?: number;
  /** terms: the handle of the taxonomy to choose from */
  taxonomy?: string;
  /** entries: collection handles to choose from; empty means any */
  collections?: string[];
  /** blocks */
  blockTypes?: BlockType[];
  maxBlocks?: number;
}

export interface Field {
  handle: string;
  label: string;
  type: FieldType;
  required: boolean;
  helpText?: string;
  options: FieldOptions;
  /** Only on fields inside a block type, while the builder edits them. */
  draft?: DraftBookkeeping;
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

/** One block in a blocks field: its own id, its block type's handle, and its values. */
export interface BlockValue {
  id: string;
  type: string;
  data: EntryData;
}

/**
 * What an entry's `data` holds for one field. `null` means "deliberately empty": the editor
 * sends it when someone clears an optional field, so the value is removed on save.
 */
export type FieldValue =
  string | string[] | number | boolean | RichTextDocument | LinkValue | BlockValue[] | null;
// Entries and terms fields store a list of ids (string[]); list fields a list of text.

/** An entry's data: field handle to value. Values arrive from the API untyped. */
export type EntryData = Record<string, unknown>;

/** The title field every entry blueprint starts with. It can be relabelled but not removed. */
export const titleFieldHandle = "title";
