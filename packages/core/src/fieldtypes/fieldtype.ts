import type { z } from "zod";
import type { AssetExists } from "./image-assets.js";

/** What a fieldtype may need while checking a value, handed in by the caller. */
export interface FieldCheckContext {
  assetExists: AssetExists;
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
  /** Checks that need the outside world, such as "this image is still in the media library". */
  checkReferences?(
    value: unknown,
    label: string,
    context: FieldCheckContext,
  ): Promise<string | null>;
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
  ): Promise<string | null>;
}

export function defineFieldtype<OptionsSchema extends z.ZodType>(
  definition: FieldtypeDefinition<OptionsSchema>,
): Fieldtype {
  return {
    ...definition,
    buildValueSchema: (options, label) =>
      definition.buildValueSchema(definition.optionsSchema.parse(options), label),
    isEmpty: (value) => isBlank(value) || (definition.isEmpty?.(value) ?? false),
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
