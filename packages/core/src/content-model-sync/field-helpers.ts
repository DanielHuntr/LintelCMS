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

import type { FieldConditionsInput } from "@lintel/field-conditions";

/** What every field can say, whatever its type. */
export interface CommonFieldOptions {
  /** The name editors see next to the input. Defaults to the handle in words: `hero_image` → "Hero image". */
  label?: string;
  /** Whether the field has to be filled in before an entry is published. Defaults to false. */
  required?: boolean;
  /** A sentence shown under the input, to help editors fill it in. */
  helpText?: string;
  /** Where the help text goes. Defaults to `"below"`. */
  helpTextPosition?: "above" | "below";
  /** How much of the row the field takes in the editor, in percent. Defaults to 100. */
  width?: 25 | 33 | 50 | 66 | 75 | 100;
  /** Grey example text shown in an empty input, such as `"e.g. Leeds"`. */
  placeholder?: string;
  /** The value a new entry starts with. It has to be one the field accepts. */
  default?: unknown;
  /** Shown but can't be changed in the editor. */
  readOnly?: boolean;
  /** Kept out of the editor; the value is still saved and delivered. */
  hidden?: boolean;
  /** Shown as a column in the list of entries. */
  showInList?: boolean;
  /** Rules on top of the field's own: length, a pattern, unique, a custom message. */
  validation?: FieldValidationRules;
  /**
   * Show or hide the field depending on other fields:
   * `{ rules: [{ field: "layout", operator: "is", value: "video" }] }`.
   * See @lintel/field-conditions for the operators and `$parent.` / `$root.` references.
   */
  conditions?: FieldConditionsInput;
}

export interface FieldValidationRules {
  /** The fewest characters, for text. */
  minLength?: number;
  /** The most characters, for text. */
  maxLength?: number;
  /** The smallest number, or the fewest items in a list. */
  min?: number;
  /** The largest number, or the most items in a list. */
  max?: number;
  /** A regular expression the text has to match, such as `"^[A-Z]{3}$"`. */
  pattern?: string;
  /** No two entries in the collection may have the same value. */
  unique?: boolean;
  /** Shown instead of Lintel's own message when the value breaks a rule. */
  message?: string;
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

export interface ChoiceOptions extends CommonFieldOptions {
  /** The choices, in the order editors see them. Each needs a different value. */
  choices: SelectChoice[];
}
export interface InlineChoiceOptions extends ChoiceOptions {
  /** Lay the choices out in a row rather than one under another. Defaults to false. */
  inline?: boolean;
}
export interface RadioField extends InlineChoiceOptions {
  type: "radio";
}
export interface CheckboxesField extends InlineChoiceOptions {
  type: "checkboxes";
}
export interface ButtonGroupField extends ChoiceOptions {
  type: "buttonGroup";
}
export interface RangeOptions extends CommonFieldOptions {
  /** The slider's lowest value. Defaults to 0. */
  min?: number;
  /** The slider's highest value. Defaults to 100. */
  max?: number;
  /** How far one step moves. Defaults to 1. */
  step?: number;
  /** Shown after the number, such as `"%"`. */
  suffix?: string;
}
export interface RangeField extends RangeOptions {
  type: "range";
}
export interface TimeField extends CommonFieldOptions {
  type: "time";
}
export interface SlugOptions extends CommonFieldOptions {
  /** The field the slug is made from as editors type. Defaults to `"title"`. */
  from?: string;
}
export interface SlugField extends SlugOptions {
  type: "slug";
}
export interface CodeOptions extends CommonFieldOptions {
  /** For highlighting: plain, html, css, javascript, typescript, json, yaml, markdown, php, python, shell or sql. */
  language?:
    | "plain"
    | "html"
    | "css"
    | "javascript"
    | "typescript"
    | "json"
    | "yaml"
    | "markdown"
    | "php"
    | "python"
    | "shell"
    | "sql";
  /** The most characters allowed. */
  maxLength?: number;
}
export interface CodeField extends CodeOptions {
  type: "code";
}
export interface TableOptions extends CommonFieldOptions {
  /** The first row is the column headings. Defaults to true. */
  headerRow?: boolean;
  /** The most rows allowed. */
  maxRows?: number;
  /** The most columns allowed, up to 20. */
  maxColumns?: number;
}
export interface TableField extends TableOptions {
  type: "table";
}
export interface VideoField extends CommonFieldOptions {
  type: "video";
}
export interface IconField extends CommonFieldOptions {
  type: "icon";
}
export interface UsersOptions extends CommonFieldOptions {
  /** The most people that can be chosen. Leave out for no limit. */
  maxItems?: number;
}
export interface UsersField extends UsersOptions {
  type: "users";
}
export interface HiddenField extends CommonFieldOptions {
  type: "hidden";
}
export interface FormField extends CommonFieldOptions {
  type: "form";
}
export interface TabField extends CommonFieldOptions {
  type: "tab";
}
export interface SectionField extends CommonFieldOptions {
  type: "section";
}
export interface SpacerField extends CommonFieldOptions {
  type: "spacer";
}
export interface RevealerOptions extends CommonFieldOptions {
  /** The button's words, such as "Show booking options". Defaults to "Show more". */
  buttonLabel?: string;
}
export interface RevealerField extends RevealerOptions {
  type: "revealer";
}
export interface GroupOptions extends CommonFieldOptions {
  /** The group's fields, keyed by handle, in the order editors see them. */
  fields: Record<string, InnerField>;
}
export interface GroupField extends GroupOptions {
  type: "group";
}
export interface RepeaterOptions extends CommonFieldOptions {
  /** The fields of each row, keyed by handle. */
  fields: Record<string, InnerField>;
  /** The fewest rows allowed. */
  minRows?: number;
  /** The most rows allowed. */
  maxRows?: number;
  /** The add button's words, such as "Add a speaker". Defaults to "Add a row". */
  addLabel?: string;
}
export interface RepeaterField extends RepeaterOptions {
  type: "repeater";
}
export interface FieldsetOptions extends CommonFieldOptions {
  /** The handle of the fieldset whose fields this uses (see `defineFieldset`). */
  fieldset: string;
}
export interface FieldsetField extends FieldsetOptions {
  type: "fieldset";
}

/** Any field except a blocks field or a tab: what a block type's or a group's fields can be. */
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
  | RadioField
  | CheckboxesField
  | ButtonGroupField
  | RangeField
  | TimeField
  | SlugField
  | CodeField
  | TableField
  | VideoField
  | IconField
  | UsersField
  | HiddenField
  | SectionField
  | SpacerField
  | RevealerField
  | GroupField
  | RepeaterField
  | FieldsetField
  | FormField;

/** A kind of block editors can add to a blocks field, such as a Hero or a Call to action. */
export interface BlockTypeDefinition {
  /** The name editors see when adding a block. Defaults to the handle in words. */
  name?: string;
  /** A sentence about the block, shown when adding one. */
  description?: string;
  /** The block's fields, keyed by handle, in the order editors see them. No blocks fields inside. */
  fields?: Record<string, InnerField>;
  /**
   * One of the site's blocks, defined in `content-model/blocks/`: its name, description and
   * properties are used, and the block type's handle should be the block's.
   */
  block?: string;
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
export type FieldSpec = InnerField | BlocksField | PageField | TabField;

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

/** One of the site's forms, such as a contact form, stored by its handle. */
export function form(options: CommonFieldOptions = {}): FormField {
  return { type: "form", ...options };
}

/** One choice from a short list, with every choice in view. */
export function radio(options: InlineChoiceOptions): RadioField {
  return { type: "radio", ...options };
}

/** Any number of choices from a list. The value is a list. */
export function checkboxes(options: InlineChoiceOptions): CheckboxesField {
  return { type: "checkboxes", ...options };
}

/** One choice from a few, as a row of buttons, such as Left, Centre or Right. */
export function buttonGroup(options: ChoiceOptions): ButtonGroupField {
  return { type: "buttonGroup", ...options };
}

/** A number picked on a slider, 0 to 100 unless `min` and `max` say otherwise. */
export function range(options: RangeOptions = {}): RangeField {
  return { type: "range", ...options };
}

/** A time of day, stored as "09:30". */
export function time(options: CommonFieldOptions = {}): TimeField {
  return { type: "time", ...options };
}

/** A web-friendly name like "summer-fair", made from another field (the title by default). */
export function slug(options: SlugOptions = {}): SlugField {
  return { type: "slug", ...options };
}

/** A snippet of code, kept exactly as typed. */
export function code(options: CodeOptions = {}): CodeField {
  return { type: "code", ...options };
}

/** A small table of text; stored as rows of cells. */
export function table(options: TableOptions = {}): TableField {
  return { type: "table", ...options };
}

/** A YouTube or Vimeo video, or a link to a video file. */
export function video(options: CommonFieldOptions = {}): VideoField {
  return { type: "video", ...options };
}

/** A small symbol from the admin's icon set, stored by name ("map-pin"). */
export function icon(options: CommonFieldOptions = {}): IconField {
  return { type: "icon", ...options };
}

/** People with an account, such as an article's authors. */
export function users(options: UsersOptions = {}): UsersField {
  return { type: "users", ...options };
}

/** A value saved with the entry that editors don't see. Give it a `default`. */
export function hidden(options: CommonFieldOptions = {}): HiddenField {
  return { type: "hidden", ...options };
}

/** Starts a new tab in the editor; the fields after it are on that tab. Holds no value. */
export function tab(options: CommonFieldOptions = {}): TabField {
  return { type: "tab", ...options };
}

/** A heading (its label) and a sentence (its help text) starting a new part of the form. */
export function section(options: CommonFieldOptions = {}): SectionField {
  return { type: "section", ...options };
}

/** Empty room in the editor, as wide as its `width`. Holds no value. */
export function spacer(options: CommonFieldOptions = {}): SpacerField {
  return { type: "spacer", ...options };
}

/** A "Show more" button; give other fields `conditions` on it to show them when pressed. */
export function revealer(options: RevealerOptions = {}): RevealerField {
  return { type: "revealer", ...options };
}

/** A few fields kept together under one name, such as an address. */
export function group(options: GroupOptions): GroupField {
  return { type: "group", ...options };
}

/** Rows of the same few fields, such as the speakers at an event. */
export function repeater(options: RepeaterOptions): RepeaterField {
  return { type: "repeater", ...options };
}

/** The fields of a saved fieldset, kept together under this field's handle. */
export function fieldset(options: FieldsetOptions): FieldsetField {
  return { type: "fieldset", ...options };
}

/** `hero_image` → "Hero image": how a field's label and a block type's name default. */
export function labelFromHandle(handle: string): string {
  const words = handle.replaceAll("_", " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
