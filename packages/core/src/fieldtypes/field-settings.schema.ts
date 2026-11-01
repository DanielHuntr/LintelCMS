import { fieldConditionsSchema } from "@lintel/field-conditions";
import { z } from "zod";

/**
 * What every field can say about how it looks and what it accepts, whatever its type. All
 * of it is optional and left out when it is the default, so blueprints made before these
 * settings existed are unchanged, and content model files only say what was chosen:
 *
 *   { "width": 50, "placeholder": "e.g. Leeds", "showInList": true,
 *     "validation": { "minLength": 3, "message": "Give the town in full" },
 *     "conditions": { "rules": [{ "field": "has_venue", "operator": "is", "value": true }] } }
 */

/** How much of the row a field takes in the entry editor, in percent. */
export const fieldWidths = [25, 33, 50, 66, 75, 100] as const;
export type FieldWidth = (typeof fieldWidths)[number];

export const fieldValidationSchema = z.strictObject({
  minLength: z
    .number({ error: "The fewest characters should be a number" })
    .int({ error: "The fewest characters should be a whole number" })
    .nonnegative({ error: "The fewest characters can't be below 0" })
    .optional(),
  maxLength: z
    .number({ error: "The most characters should be a number" })
    .int({ error: "The most characters should be a whole number" })
    .positive({ error: "The most characters should be more than 0" })
    .optional(),
  /** For numbers, the smallest value; for lists, the fewest items. */
  min: z.number({ error: "The minimum should be a number" }).optional(),
  /** For numbers, the largest value; for lists, the most items. */
  max: z.number({ error: "The maximum should be a number" }).optional(),
  pattern: z
    .string({ error: "The pattern should be text" })
    .max(200, { error: "Patterns can be at most 200 characters" })
    .refine(isUsablePattern, { error: "The pattern isn't a valid regular expression" })
    .optional(),
  /** No two entries in the collection may have the same value. */
  unique: z.boolean({ error: "unique should be true or false" }).optional(),
  /** Shown instead of Lintel's own message when the value breaks any of these rules. */
  message: z
    .string({ error: "The message should be text" })
    .max(200, { error: "Messages can be at most 200 characters" })
    .optional(),
});

export type FieldValidation = z.output<typeof fieldValidationSchema>;

function isUsablePattern(pattern: string): boolean {
  try {
    new RegExp(pattern, "u");
    return true;
  } catch {
    return false;
  }
}

/** The keys a field definition takes besides handle, label, type, required, help text and options. */
export const fieldSettingsShape = {
  width: z
    .union(
      fieldWidths.map((width) => z.literal(width)),
      { error: `The width should be one of: ${fieldWidths.join(", ")}` },
    )
    .optional(),
  placeholder: z
    .string({ error: "The placeholder should be text" })
    .max(200, { error: "Placeholders can be at most 200 characters" })
    .optional(),
  /** The value a new entry starts with. Checked against the fieldtype when the blueprint is saved. */
  default: z.unknown().optional(),
  helpTextPosition: z
    .enum(["above", "below"], { error: 'Help text goes "above" or "below" the field' })
    .optional(),
  readOnly: z.boolean({ error: "readOnly should be true or false" }).optional(),
  /** Kept out of the editor's way: the value is still saved and delivered. */
  hidden: z.boolean({ error: "hidden should be true or false" }).optional(),
  /** Shown as a column in the list of entries. */
  showInList: z.boolean({ error: "showInList should be true or false" }).optional(),
  validation: fieldValidationSchema.optional(),
  conditions: fieldConditionsSchema.optional(),
};

/** The value each setting has when it is left out; a setting with this value is dropped. */
const settingDefaults: Readonly<Record<string, unknown>> = {
  width: 100,
  placeholder: "",
  helpTextPosition: "below",
  readOnly: false,
  hidden: false,
  showInList: false,
};

/**
 * The settings without their defaults (and without an empty validation object), so a field
 * reads the same whether a default was written down or left out.
 */
export function withoutDefaultSettings<Field extends Record<string, unknown>>(field: Field): Field {
  const result: Record<string, unknown> = { ...field };
  for (const [key, value] of Object.entries(settingDefaults)) {
    if (result[key] === value) delete result[key];
  }
  if (result.default === null || result.default === undefined) delete result.default;
  const validation = result.validation as Record<string, unknown> | undefined;
  if (validation) {
    const kept = Object.fromEntries(
      Object.entries(validation).filter(
        ([key, value]) =>
          value !== undefined && value !== "" && !(key === "unique" && value === false),
      ),
    );
    if (Object.keys(kept).length === 0) delete result.validation;
    else result.validation = kept;
  }
  return result as Field;
}
