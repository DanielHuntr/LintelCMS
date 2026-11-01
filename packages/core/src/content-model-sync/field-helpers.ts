/**
 * The field helpers used in content model files: `text()`, `richText()`, `blocks({...})`.
 * There is one for every fieldtype in src/fieldtypes/fieldtypes.registry.ts, with the same
 * options, so a file can say anything the blueprint builder can.
 *
 * Each helper only returns a plain object (`{ type: "text", maxLength: 80 }`), the same
 * shape a YAML file uses, so both formats are read by one set of rules. The handle comes
 * from the key the field is given in `fields`, and the label from the handle unless one is
 * set (`hero_image` is labelled "Hero image").
 */

/** What every field can say, whatever its type. */
export interface CommonFieldOptions {
  /** The name editors see next to the input. Defaults to the handle in words: `hero_image` → "Hero image". */
  label?: string;
  /** Whether the field has to be filled in before an entry is published. Defaults to false. */
  required?: boolean;
  /** A sentence shown under the input, to help editors fill it in. */
  helpText?: string;
}

export interface MaxLengthOptions extends CommonFieldOptions {
  /** The most characters allowed. Leave out for no limit. */
  maxLength?: number;
}

export interface TextField extends MaxLengthOptions {
  type: "text";
}
export interface TextareaField extends MaxLengthOptions {
  type: "textarea";
}
export interface RichTextField extends CommonFieldOptions {
  type: "richText";
}
export interface NumberOptions extends CommonFieldOptions {
  /** The smallest number allowed. */
  min?: number;
  /** The largest number allowed. */
  max?: number;
  /** The number has to go up in steps of this, counted from `min` (or 0). */
  step?: number;
}
export interface NumberField extends NumberOptions {
  type: "number";
}
export interface ToggleField extends CommonFieldOptions {
  type: "toggle";
}
export interface FormField extends CommonFieldOptions {
  type: "form";
}
/** One choice of a select field: `value` is stored, `label` is what editors see. */
export interface SelectChoice {
  value: string;
  label: string;
}
export interface SelectOptions extends CommonFieldOptions {
  /** The choices, in the order editors see them. Each needs a different value. */
  choices: SelectChoice[];
  /** Let editors pick more than one; the value is then a list. Defaults to false. */
  multiple?: boolean;
}
export interface SelectField extends SelectOptions {
  type: "select";
}
export interface DateOptions extends CommonFieldOptions {
  /** Ask for a time of day as well as the date. Defaults to false. */
  includeTime?: boolean;
}
export interface DateField extends DateOptions {
  type: "date";
}
export interface ImageField extends CommonFieldOptions {
  type: "image";
}
export interface LinkField extends CommonFieldOptions {
  type: "link";
}
export interface EmailField extends CommonFieldOptions {
  type: "email";
}
export interface UrlField extends CommonFieldOptions {
  type: "url";
}
export interface ColourOptions extends CommonFieldOptions {
  /** Colours to suggest, like `"#1a2b3c"`; at most 24. */
  swatches?: string[];
}
export interface ColourField extends ColourOptions {
  type: "colour";
}
export interface MarkdownField extends MaxLengthOptions {
  type: "markdown";
}
export interface ListOptions extends CommonFieldOptions {
  /** The most items allowed. Leave out for no limit. */
  maxItems?: number;
}
export interface ListField extends ListOptions {
  type: "list";
}
export interface EntriesOptions extends CommonFieldOptions {
  /** Handles of the collections editors may pick from. Leave out to allow every collection. */
  collections?: string[];
  /** The most entries that can be chosen. Leave out for no limit. */
  maxItems?: number;
}
export interface EntriesField extends EntriesOptions {
  type: "entries";
}
export interface TermsOptions extends CommonFieldOptions {
  /** The handle of the taxonomy the terms come from, such as `"categories"`. */
  taxonomy: string;
  /** The most terms that can be chosen. Leave out for no limit. */
  maxItems?: number;
}
export interface TermsField extends TermsOptions {
  type: "terms";
}

/** Any field except a blocks field: what a block type's own fields can be. */
export type InnerField =
  | TextField
  | TextareaField
  | RichTextField
  | NumberField
  | ToggleField
  | SelectField
  | DateField
  | ImageField
  | LinkField
  | EmailField
  | UrlField
  | ColourField
  | MarkdownField
  | ListField
  | EntriesField
  | TermsField
  | FormField;

/** A kind of block editors can add to a blocks field, such as a Hero or a Call to action. */
export interface BlockTypeDefinition {
  /** The name editors see when adding a block. Defaults to the handle in words. */
  name?: string;
  /** A sentence about the block, shown when adding one. */
  description?: string;
  /** The block's fields, keyed by handle, in the order editors see them. No blocks fields inside. */
  fields: Record<string, InnerField>;
}

export interface BlocksOptions extends CommonFieldOptions {
  /** The kinds of block editors can add, keyed by handle, in the order they're offered. */
  blockTypes: Record<string, BlockTypeDefinition>;
  /** The most blocks allowed. Leave out for no limit. */
  maxBlocks?: number;
}
export interface BlocksField extends BlocksOptions {
  type: "blocks";
}
export interface PageField extends CommonFieldOptions {
  type: "page";
}

/** Any field a content type or a global set can have. */
export type FieldSpec = InnerField | BlocksField | PageField;

/** Every field type, for checking the helpers cover the fieldtype registry. */
export type FieldTypeName = FieldSpec["type"];

/** A single line of text, such as a title or a name. */
export function text(options: MaxLengthOptions = {}): TextField {
  return { type: "text", ...options };
}

/** A few lines of plain text, such as a summary or an excerpt. */
export function textarea(options: MaxLengthOptions = {}): TextareaField {
  return { type: "textarea", ...options };
}

/** Formatted writing with headings, lists, links and quotes. */
export function richText(options: CommonFieldOptions = {}): RichTextField {
  return { type: "richText", ...options };
}

/** A number, such as a price, a quantity or a rating. */
export function number(options: NumberOptions = {}): NumberField {
  return { type: "number", ...options };
}

/** An on or off switch, such as "Show in the menu". */
export function toggle(options: CommonFieldOptions = {}): ToggleField {
  return { type: "toggle", ...options };
}

/** One of the site's forms, such as a contact form (needs the Forms feature). */
export function form(options: CommonFieldOptions = {}): FormField {
  return { type: "form", ...options };
}

/** A choice from a list you set up, such as a category. Can allow several. */
export function select(options: SelectOptions): SelectField {
  return { type: "select", ...options };
}

/** A calendar date, with a time of day if `includeTime` is set. */
export function date(options: DateOptions = {}): DateField {
  return { type: "date", ...options };
}

/** A picture from the media library. */
export function image(options: CommonFieldOptions = {}): ImageField {
  return { type: "image", ...options };
}

/** A link to a web page, an email address or a page on this site. */
export function link(options: CommonFieldOptions = {}): LinkField {
  return { type: "link", ...options };
}

/** An email address. */
export function email(options: CommonFieldOptions = {}): EmailField {
  return { type: "email", ...options };
}

/** The address of a web page, starting with https:// or http://. */
export function url(options: CommonFieldOptions = {}): UrlField {
  return { type: "url", ...options };
}

/** A colour, such as a brand or background colour. */
export function colour(options: ColourOptions = {}): ColourField {
  return { type: "colour", ...options };
}

/** A page laid out in the visual page builder (see src/pages). Not allowed inside blocks. */
export function page(options: CommonFieldOptions = {}): PageField {
  return { type: "page", ...options };
}

/** Writing in Markdown. */
export function markdown(options: MaxLengthOptions = {}): MarkdownField {
  return { type: "markdown", ...options };
}

/** A list of short items, such as opening times or ingredients. */
export function list(options: ListOptions = {}): ListField {
  return { type: "list", ...options };
}

/** Links to other entries, such as related posts. */
export function entries(options: EntriesOptions = {}): EntriesField {
  return { type: "entries", ...options };
}

/** Terms from a taxonomy, such as a post's categories or tags. */
export function terms(options: TermsOptions): TermsField {
  return { type: "terms", ...options };
}

/** A page builder: sections such as a hero, text or a call to action, in any order. */
export function blocks(options: BlocksOptions): BlocksField {
  return { type: "blocks", ...options };
}

/** `hero_image` → "Hero image": how a field's label and a block type's name default. */
export function labelFromHandle(handle: string): string {
  const words = handle.replaceAll("_", " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
