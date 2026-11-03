import type { ComponentVariants } from "@lintel/builder-model";
import type { z } from "zod";
import type { FieldMessages } from "../http/http-errors.js";
import type { ContentReferences } from "./content-references.js";
import type { FieldDefinition } from "./field-definition.schema.js";
import type { AssetExists } from "./image-assets.js";

/** What a fieldtype may need while checking a value, handed in by the caller. */
export interface FieldCheckContext {
  assetExists: AssetExists;
  /** For entries and terms fields. Without it every id is accepted, as in unit tests. */
  references?: ContentReferences;
  /**
   * "allowEmpty" lets required fields be empty, for saving a draft that isn't finished;
   * required fields are then checked when it is published. Defaults to "enforce".
   */
  requiredFields?: "enforce" | "allowEmpty";
  /** Handles that stay required even when `requiredFields` is "allowEmpty", such as title. */
  alwaysRequired?: readonly string[];
  /**
   * The values stored before this save, for fieldtypes whose rules depend on what changed
   * (a page's code). Left out when nothing is being changed by a person, such as publishing.
   */
  previousData?: Readonly<Record<string, unknown>>;
  /** Who is saving and the site's rules for page code; see src/pages. */
  pageCode?: PageCodeContext;
  /**
   * The site's own blocks, for checking the values of instances in page designs (see
   * src/blocks). Without it, instances are kept as they are, as in unit tests.
   */
  blockLibrary?: BlockCheckLibrary;
  /**
   * For fields marked unique: whether no other entry in the collection has this value.
   * Without it (global sets, unit tests) every value counts as unique.
   */
  isValueUnique?: (handle: string, value: unknown) => Promise<boolean>;
}

/** The site's blocks as checking needs them: their names and properties, by handle. */
export interface BlockCheckLibrary {
  find(handle: string):
    | {
        name: string;
        properties: readonly FieldDefinition[];
        renamedProperties: Readonly<Record<string, string>>;
        /** Its variants, so an instance's choices can be checked. None when left out. */
        variants?: ComponentVariants;
      }
    | undefined;
}

/** What the page fieldtype needs to know about the person saving and the site. */
export interface PageCodeContext {
  /** Whether they have `builder:code`, so they may add or change code. */
  mayEditCode: boolean;
  /** The site setting `builderCustomScripts`. */
  scriptRule: "removeScripts" | "allowScripts";
}

/** The groups the builder's "Add a field" sorts fieldtypes into, in the order it shows them. */
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

/** What `checkChange` gives back: the value to store, or a message for the editor. */
export type ChangeCheckResult = { value: unknown } | { problem: string };

/**
 * Checks values against a list of fields with the same rules as a whole entry. Handed to
 * fieldtypes that hold other fields (blocks), so they don't import the entry validator,
 * which itself imports every fieldtype.
 */
export type CheckFieldValues = (
  fields: readonly FieldDefinition[],
  data: Readonly<Record<string, unknown>>,
) => Promise<{ values: Record<string, unknown>; messages: FieldMessages }>;

/**
 * Checks the fields a fieldtype holds inside it (a block type's fields), with the same
 * rules as a blueprint's own fields. `where` names the list in messages ("Hero").
 */
export type CheckInnerFieldList = (
  candidates: readonly unknown[],
  where: string,
) => { fields: FieldDefinition[] } | { problem: string };

/**
 * What checking a value with fields inside gives back: the value to store, or messages.
 * `messages` holds one summary for the field itself under `""`, and one per inner field
 * under a key such as `"<blockId>.heading"`; the validator adds the field's handle in front.
 */
export interface NestedCheckResult {
  value: unknown;
  messages: FieldMessages;
}

/**
 * A kind of field an editor can add to a blueprint: text, number, image... Each one says
 * what options it takes and what a stored value must look like.
 *
 * Messages use the field's label ("Summary can be at most 300 characters"), because that
 * is the name the editor sees next to the input.
 */
export interface FieldtypeDefinition<OptionsSchema extends z.ZodType> {
  type: string;
  /** Shown in the blueprint builder's list of fieldtypes. */
  name: string;
  /** One plain sentence about what the editor gets, for the same list. */
  description: string;
  /** Where the builder's "Add a field" lists it. Defaults to "advanced". */
  category?: FieldtypeCategory;
  /** Other words people search for it by: "dropdown" finds Select. */
  keywords?: readonly string[];
  /**
   * False for fields that only arrange the editor (a section heading, a spacer, a tab): they
   * store nothing and are left out of the API. Defaults to true.
   */
  holdsValue?: boolean;
  /**
   * False for fieldtypes that can only be a blueprint's own field, not one inside a group,
   * repeater or block (a page builder, a tab). Defaults to true.
   */
  canBeInside?: boolean;
  optionsSchema: OptionsSchema;
  /** The shape a stored value must have, for a field with these options. */
  buildValueSchema(options: z.output<OptionsSchema>, label: string): z.ZodType;
  /**
   * For values that look filled in but aren't, such as a rich text document with only an
   * empty paragraph. null, undefined, blank text and empty lists always count as empty.
   */
  isEmpty?(value: unknown): boolean;
  /**
   * Checks that need the outside world, such as "this image is still in the media library".
   * `options` are the field's own, for checks that depend on them (which taxonomy, say).
   */
  checkReferences?(
    value: unknown,
    label: string,
    context: FieldCheckContext,
    options: z.output<OptionsSchema>,
  ): Promise<string | null>;
  /**
   * For fieldtypes that hold other fields: checks those field definitions when the
   * blueprint is saved, and gives back the options with them filled in.
   */
  checkInnerFields?(
    options: z.output<OptionsSchema>,
    checkFieldList: CheckInnerFieldList,
  ): { options: z.output<OptionsSchema> } | { problem: string };
  /** For fieldtypes that hold other fields: checks the values inside them. */
  checkNestedValues?(
    value: unknown,
    options: z.output<OptionsSchema>,
    label: string,
    checkFieldValues: CheckFieldValues,
    context: FieldCheckContext,
  ): Promise<NestedCheckResult>;
  /**
   * The last check, for rules about who changed what: compares the value with the one stored
   * before (`undefined` for a new entry) and may give back a cleaned-up value to store.
   */
  checkChange?(
    value: unknown,
    previousValue: unknown,
    label: string,
    context: FieldCheckContext,
  ): ChangeCheckResult;
  /**
   * What websites get for a stored value, through the delivery API, GraphQL (as JSON) and
   * Liquid templates. Left out, they get the value as it is stored. Never called with null.
   * Plugins' fieldtypes use it to add what a site needs to print the value, such as a
   * colour's name beside its hex code.
   */
  deliver?(value: unknown, options: z.output<OptionsSchema>): unknown;
}

/**
 * A fieldtype with its options type erased, so different fieldtypes can share one list.
 * Options are checked against `optionsSchema` when a blueprint is saved, so by the time
 * `buildValueSchema` runs they are known to be valid.
 */
export interface Fieldtype {
  type: string;
  name: string;
  description: string;
  category: FieldtypeCategory;
  keywords: readonly string[];
  holdsValue: boolean;
  canBeInside: boolean;
  optionsSchema: z.ZodType;
  buildValueSchema(options: unknown, label: string): z.ZodType;
  isEmpty(value: unknown): boolean;
  checkReferences?(
    value: unknown,
    label: string,
    context: FieldCheckContext,
    options: unknown,
  ): Promise<string | null>;
  checkInnerFields?(
    options: unknown,
    checkFieldList: CheckInnerFieldList,
  ): { options: unknown } | { problem: string };
  checkNestedValues?(
    value: unknown,
    options: unknown,
    label: string,
    checkFieldValues: CheckFieldValues,
    context: FieldCheckContext,
  ): Promise<NestedCheckResult>;
  checkChange?(
    value: unknown,
    previousValue: unknown,
    label: string,
    context: FieldCheckContext,
  ): ChangeCheckResult;
  deliver?(value: unknown, options: unknown): unknown;
}

export function defineFieldtype<OptionsSchema extends z.ZodType>(
  definition: FieldtypeDefinition<OptionsSchema>,
): Fieldtype {
  const { checkReferences, checkInnerFields, checkNestedValues, deliver } = definition;
  return {
    ...definition,
    category: definition.category ?? "advanced",
    keywords: definition.keywords ?? [],
    holdsValue: definition.holdsValue ?? true,
    canBeInside: definition.canBeInside ?? true,
    buildValueSchema: (options, label) =>
      definition.buildValueSchema(definition.optionsSchema.parse(options), label),
    isEmpty: (value) => isBlank(value) || (definition.isEmpty?.(value) ?? false),
    checkReferences:
      checkReferences &&
      ((value, label, context, options) =>
        checkReferences(value, label, context, definition.optionsSchema.parse(options))),
    checkInnerFields: checkInnerFields
      ? (options, checkFieldList) =>
          checkInnerFields(definition.optionsSchema.parse(options), checkFieldList)
      : undefined,
    checkNestedValues: checkNestedValues
      ? (value, options, label, checkFieldValues, context) =>
          checkNestedValues(
            value,
            definition.optionsSchema.parse(options),
            label,
            checkFieldValues,
            context,
          )
      : undefined,
    deliver: deliver
      ? (value, options) => deliver(value, definition.optionsSchema.parse(options))
      : undefined,
  };
}

function isBlank(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0)
  );
}
