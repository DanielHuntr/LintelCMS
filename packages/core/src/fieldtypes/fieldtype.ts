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
}

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
  ): Promise<NestedCheckResult>;
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
  ): Promise<NestedCheckResult>;
}

export function defineFieldtype<OptionsSchema extends z.ZodType>(
  definition: FieldtypeDefinition<OptionsSchema>,
): Fieldtype {
  const { checkReferences, checkInnerFields, checkNestedValues } = definition;
  return {
    ...definition,
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
      ? (value, options, label, checkFieldValues) =>
          checkNestedValues(value, definition.optionsSchema.parse(options), label, checkFieldValues)
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
