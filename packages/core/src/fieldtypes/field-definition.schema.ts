import { z } from "zod";
import { handleSchema } from "../http/handle.schema.js";
import { conditionReferenceProblem } from "./condition-references.js";
import { fieldSettingsShape, withoutDefaultSettings } from "./field-settings.schema.js";
import type { CheckInnerFieldList } from "./fieldtype.js";
import { fieldtypeNames, findFieldtype } from "./fieldtypes.registry.js";

/**
 * One field in a blueprint, as the blueprint builder sends it and as it is stored:
 *
 *   { "handle": "hero_image", "label": "Hero image", "type": "image", "required": false,
 *     "helpText": "Shown at the top of the page", "options": {} }
 *
 * The options are checked against the fieldtype's own schema, and stored with that
 * schema's defaults filled in, so later code never has to guess them. The settings every
 * field shares (width, conditions, validation...) are in field-settings.schema.ts; those are
 * stored without their defaults instead, so older blueprints read the same.
 */
export const fieldDefinitionSchema = z
  .object({
    handle: handleSchema("Each field needs a handle"),
    label: z
      .string({ error: "Each field needs a label" })
      .trim()
      .min(1, { error: "Each field needs a label" })
      .max(100, { error: "Labels can be at most 100 characters" }),
    // Checked against the list when a field is read rather than built into an enum, so
    // fieldtypes from plugins are accepted too.
    type: z
      .string({ error: "Each field needs a type" })
      .refine((type) => findFieldtype(type) !== undefined, {
        error: () => `The type should be one of: ${fieldtypeNames().join(", ")}`,
      }),
    required: z.boolean({ error: "required should be true or false" }).default(false),
    helpText: z
      .string({ error: "Help text should be text" })
      .max(500, { error: "Help text can be at most 500 characters" })
      .default(""),
    options: z
      .record(z.string(), z.unknown(), { error: "Options should be an object" })
      .default({}),
    ...fieldSettingsShape,
  })
  .transform((field, context) => {
    const fieldtype = findFieldtype(field.type);
    const options = fieldtype?.optionsSchema.safeParse(field.options);
    if (!options?.success) {
      context.issues.push({
        code: "custom",
        message: options?.error.issues[0]?.message ?? "These options aren't right",
        input: field.options,
        path: ["options"],
      });
      return z.NEVER;
    }
    // Fields inside this one (a blocks field's block types) are checked the same way.
    const checked = fieldtype?.checkInnerFields
      ? fieldtype.checkInnerFields(options.data, checkInnerFieldList)
      : { options: options.data };
    if ("problem" in checked) {
      context.issues.push({
        code: "custom",
        message: checked.problem,
        input: field.options,
        path: ["options"],
      });
      return z.NEVER;
    }
    const checkedOptions = checked.options as Record<string, unknown>;
    const defaultProblem = findDefaultProblem(field, checkedOptions);
    if (defaultProblem) {
      context.issues.push({
        code: "custom",
        message: defaultProblem,
        input: field.default,
        path: ["default"],
      });
      return z.NEVER;
    }
    return withoutDefaultSettings({ ...field, options: checkedOptions });
  });

/** A default value has to be one the field would accept. */
function findDefaultProblem(
  field: { type: string; label: string; default?: unknown },
  options: Record<string, unknown>,
): string | null {
  const fieldtype = findFieldtype(field.type);
  if (!fieldtype || fieldtype.isEmpty(field.default)) {
    return null;
  }
  if (!fieldtype.holdsValue) {
    return `${field.label} doesn't hold a value, so it can't have a default`;
  }
  const parsed = fieldtype.buildValueSchema(options, field.label).safeParse(field.default);
  return parsed.success
    ? null
    : `The default for ${field.label} isn't right: ${parsed.error.issues[0]?.message ?? ""}`.trim();
}

export type FieldDefinition = z.output<typeof fieldDefinitionSchema>;

/**
 * Checks the fields inside another field, such as a block type's or a group's fields: each
 * one as a blueprint field, with handles unique in the list, and conditions that point at
 * fields beside them. Groups and repeaters can go inside; a page builder or a tab can't.
 */
const checkInnerFieldList: CheckInnerFieldList = (candidates, where) => {
  const fields: FieldDefinition[] = [];
  const handles = new Set<string>();
  for (const [index, candidate] of candidates.entries()) {
    const parsed = fieldDefinitionSchema.safeParse(candidate);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "This field isn't right";
      return { problem: `${where}, field ${index + 1}: ${message}` };
    }
    const inner = parsed.data;
    const innerFieldtype = findFieldtype(inner.type);
    if (innerFieldtype && !innerFieldtype.canBeInside) {
      return { problem: `${where} can't have a ${innerFieldtype.name} field inside it` };
    }
    if (handles.has(inner.handle)) {
      return { problem: `${where} has two fields with the handle "${inner.handle}"` };
    }
    handles.add(inner.handle);
    fields.push(inner);
  }
  for (const field of fields) {
    const problem = conditionReferenceProblem(field, fields, null);
    if (problem) {
      return { problem: `${where}: ${problem}` };
    }
  }
  return { fields };
};
