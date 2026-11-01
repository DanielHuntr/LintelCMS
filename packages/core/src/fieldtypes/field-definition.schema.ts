import { z } from "zod";
import { handleSchema } from "../http/handle.schema.js";
import { fieldtypeNames, findFieldtype } from "./fieldtypes.registry.js";

/**
 * One field in a blueprint, as the blueprint builder sends it and as it is stored:
 *
 *   { "handle": "hero_image", "label": "Hero image", "type": "image", "required": false,
 *     "helpText": "Shown at the top of the page", "options": {} }
 *
 * The options are checked against the fieldtype's own schema, and stored with that
 * schema's defaults filled in, so later code never has to guess them.
 */
export const fieldDefinitionSchema = z
  .object({
    handle: handleSchema("Each field needs a handle"),
    label: z
      .string({ error: "Each field needs a label" })
      .trim()
      .min(1, { error: "Each field needs a label" })
      .max(100, { error: "Labels can be at most 100 characters" }),
    type: z.enum(fieldtypeNames as [string, ...string[]], {
      error: `The type should be one of: ${fieldtypeNames.join(", ")}`,
    }),
    required: z.boolean({ error: "required should be true or false" }).default(false),
    helpText: z
      .string({ error: "Help text should be text" })
      .max(500, { error: "Help text can be at most 500 characters" })
      .default(""),
    options: z
      .record(z.string(), z.unknown(), { error: "Options should be an object" })
      .default({}),
  })
  .transform((field, context) => {
    const optionsSchema = findFieldtype(field.type)?.optionsSchema;
    const options = optionsSchema?.safeParse(field.options);
    if (!options?.success) {
      context.issues.push({
        code: "custom",
        message: options?.error.issues[0]?.message ?? "These options aren't right",
        input: field.options,
        path: ["options"],
      });
      return z.NEVER;
    }
    return { ...field, options: options.data as Record<string, unknown> };
  });

export type FieldDefinition = z.output<typeof fieldDefinitionSchema>;
