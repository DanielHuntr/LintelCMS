import { fieldConditionsSchema } from "@lintel/field-conditions";
import { z } from "zod";
import { collectionStructures } from "../collections/collections.schema.js";
import { fieldValidationSchema, fieldWidths } from "../fieldtypes/field-settings.schema.js";
import { codeLanguages } from "../fieldtypes/writing-fieldtypes.js";
import type { ModelDefinition } from "./define-content-model.js";

/**
 * The shape of a content model file, checked when it is read: a TypeScript file's default
 * export, or a YAML file as it is parsed. Only the shape is checked here (unknown keys, a
 * number where text should be); the rules about values (handles, route patterns, choices)
 * are the ones the admin uses, applied in model-from-definitions.ts.
 *
 * The same schema becomes the JSON Schema VS Code uses for YAML files (`model pull
 * --format yaml` writes it as lintel.schema.json). The TypeScript interfaces in
 * define-content-model.ts and field-helpers.ts carry editor documentation, which Zod types
 * can't, so they are written out; the check at the end of this file keeps the two in step.
 */

const commonFieldShape = {
  label: z.string().optional().describe("The name editors see. Defaults to the handle in words."),
  required: z.boolean().optional().describe("Whether it has to be filled in before publishing."),
  helpText: z.string().optional().describe("A sentence shown under the input."),
  helpTextPosition: z.enum(["above", "below"]).optional().describe("Where the help text goes."),
  width: z
    .union(fieldWidths.map((width) => z.literal(width)))
    .optional()
    .describe("How much of the row the field takes, in percent. Defaults to 100."),
  placeholder: z.string().optional().describe("Example text shown in an empty input."),
  default: z.unknown().optional().describe("The value a new entry starts with."),
  readOnly: z.boolean().optional().describe("Shown but can't be changed."),
  hidden: z.boolean().optional().describe("Kept out of the editor; still saved."),
  showInList: z.boolean().optional().describe("Shown as a column in the list of entries."),
  validation: fieldValidationSchema
    .optional()
    .describe("Length, pattern, unique and a custom message."),
  conditions: fieldConditionsSchema
    .optional()
    .describe("Show or hide the field: { rules: [{ field, operator, value }] }."),
};

function fieldSchema<Type extends string, Shape extends z.ZodRawShape>(
  type: Type,
  description: string,
  shape: Shape,
) {
  return z
    .strictObject({ type: z.literal(type), ...commonFieldShape, ...shape })
    .describe(description);
}

const maxLength = z.number().int().positive().optional().describe("The most characters allowed.");
const maxItems = z.number().int().positive().optional().describe("The most that can be chosen.");

const innerFieldSchemas = [
  fieldSchema("text", "A single line of text.", { maxLength }),
  fieldSchema("textarea", "A few lines of plain text.", { maxLength }),
  fieldSchema("richText", "Formatted writing with headings, lists and links.", {}),
  fieldSchema("number", "A number.", {
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().positive().optional(),
  }),
  fieldSchema("toggle", "An on or off switch.", {}),
  fieldSchema("select", "A choice from a list.", {
    choices: z
      .array(z.strictObject({ value: z.string(), label: z.string() }))
      .describe("The choices, in order: `value` is stored, `label` is shown."),
    multiple: z.boolean().optional().describe("Let editors pick more than one."),
  }),
  fieldSchema("date", "A calendar date.", {
    includeTime: z.boolean().optional().describe("Ask for a time of day too."),
  }),
  fieldSchema("image", "A picture from the media library.", {}),
  fieldSchema("link", "A link to a page, an email address or a page on this site.", {}),
  fieldSchema("email", "An email address.", {}),
  fieldSchema("url", "A web address.", {}),
  fieldSchema("colour", "A colour.", {
    swatches: z.array(z.string()).optional().describe('Colours to suggest, like "#1a2b3c".'),
  }),
  fieldSchema("markdown", "Writing in Markdown.", { maxLength }),
  fieldSchema("list", "A list of short items.", { maxItems }),
  fieldSchema("entries", "Links to other entries.", {
    collections: z.array(z.string()).optional().describe("Collections editors may pick from."),
    maxItems,
  }),
  fieldSchema("terms", "Terms from a taxonomy.", {
    taxonomy: z.string().describe("The handle of the taxonomy the terms come from."),
    maxItems,
  }),
] as const;

const choices = z
  .array(z.strictObject({ value: z.string(), label: z.string() }))
  .describe("The choices, in order: `value` is stored, `label` is shown.");
const inline = z.boolean().optional().describe("Lay the choices out in a row.");

const moreFieldSchemas = [
  fieldSchema("radio", "One choice from a short list.", { choices, inline }),
  fieldSchema("checkboxes", "Any number of choices from a list.", { choices, inline }),
  fieldSchema("buttonGroup", "One choice from a few, as a row of buttons.", { choices }),
  fieldSchema("range", "A number picked on a slider.", {
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().positive().optional(),
    suffix: z.string().optional().describe('Shown after the number, like "%".'),
  }),
  fieldSchema("time", "A time of day.", {}),
  fieldSchema("slug", "A web-friendly name made from another field.", {
    from: z.string().optional().describe('The field it is made from. Defaults to "title".'),
  }),
  fieldSchema("code", "A snippet of code.", {
    language: z.enum(codeLanguages).optional(),
    maxLength,
  }),
  fieldSchema("table", "A small table of text.", {
    headerRow: z.boolean().optional().describe("The first row is the headings. Defaults to true."),
    maxRows: z.number().int().positive().optional(),
    maxColumns: z.number().int().positive().max(20).optional(),
  }),
  fieldSchema("video", "A YouTube or Vimeo video, or a video file.", {}),
  fieldSchema("icon", "A small symbol from the icon set.", {}),
  fieldSchema("users", "People with an account.", { maxItems }),
  fieldSchema("hidden", "A value editors don't see.", {}),
  fieldSchema("section", "A heading starting a new part of the form.", {}),
  fieldSchema("spacer", "Empty room in the editor.", {}),
  fieldSchema("revealer", "A Show more button other fields' conditions can look at.", {
    buttonLabel: z.string().optional(),
  }),
  fieldSchema("fieldset", "The fields of a saved fieldset.", {
    fieldset: z.string().describe("The handle of the fieldset."),
  }),
] as const;

// Groups and repeaters hold fields of their own, which can be groups and repeaters too.
const innerFieldSchema: z.ZodType<unknown> = z.lazy(() => innerFieldUnion);
const nestedFields = z
  .record(z.string(), innerFieldSchema)
  .describe("The fields inside, keyed by handle, in order.");
const groupFieldSchema = fieldSchema("group", "A few fields kept together.", {
  fields: nestedFields,
});
const repeaterFieldSchema = fieldSchema("repeater", "Rows of the same few fields.", {
  fields: nestedFields,
  minRows: z.number().int().positive().optional(),
  maxRows: z.number().int().positive().optional(),
  addLabel: z.string().optional().describe('The add button\'s words, like "Add a speaker".'),
});
const innerFieldUnion = z.discriminatedUnion("type", [
  ...innerFieldSchemas,
  ...moreFieldSchemas,
  groupFieldSchema,
  repeaterFieldSchema,
]);

const blockTypeSchema = z.strictObject({
  name: z.string().optional().describe("The name editors see. Defaults to the handle in words."),
  description: z.string().optional().describe("A sentence shown when adding a block."),
  fields: z.record(z.string(), innerFieldSchema).describe("The block's fields, keyed by handle."),
});

const blocksFieldSchema = fieldSchema("blocks", "A page builder made of blocks.", {
  blockTypes: z
    .record(z.string(), blockTypeSchema)
    .describe("The kinds of block editors can add, keyed by handle."),
  maxBlocks: z.number().int().positive().optional().describe("The most blocks allowed."),
});

const pageFieldSchema = fieldSchema("page", "A page laid out in the visual page builder.", {});
const tabFieldSchema = fieldSchema("tab", "Starts a new tab in the editor.", {});

export const fieldSpecSchema = z.discriminatedUnion("type", [
  ...innerFieldSchemas,
  ...moreFieldSchemas,
  groupFieldSchema,
  repeaterFieldSchema,
  blocksFieldSchema,
  pageFieldSchema,
  tabFieldSchema,
]);

const fieldsSchema = z
  .record(z.string(), fieldSpecSchema)
  .describe("The fields, keyed by handle, in the order editors see them.");

const collectionDefinitionSchema = z.strictObject({
  handle: z.string().describe("Used in the delivery API's addresses."),
  name: z.string().describe("What editors see in the Content section."),
  structure: z.enum(collectionStructures).describe("tree, dated or flat."),
  route: z
    .string()
    .nullable()
    .optional()
    .describe("Where an entry lives on the site, like /blog/{slug}. null for no page."),
});

export const modelDefinitionSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("contentType"),
    handle: z.string(),
    name: z.string(),
    collection: z
      .union([collectionDefinitionSchema, z.array(collectionDefinitionSchema)])
      .optional(),
    fields: fieldsSchema,
  }),
  z.strictObject({ kind: z.literal("taxonomy"), handle: z.string(), name: z.string() }),
  z.strictObject({
    kind: z.literal("globalSet"),
    handle: z.string(),
    name: z.string(),
    fields: fieldsSchema,
  }),
  z.strictObject({
    kind: z.literal("fieldset"),
    handle: z.string(),
    name: z.string(),
    fields: fieldsSchema,
  }),
  z.strictObject({
    kind: z.literal("menu"),
    handle: z.string(),
    name: z.string(),
    maxDepth: z.number().int().min(1).max(5).optional(),
  }),
]);

/** The JSON Schema for YAML content model files, for VS Code's YAML extension. */
export function modelDefinitionJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(modelDefinitionSchema, { io: "input" }),
    title: "Lintel content model file",
  };
}

/**
 * Fails to compile if a definition the TypeScript helpers can make isn't one this schema
 * accepts, so the two can't drift apart.
 */
type AcceptsEveryDefinition<Definition extends z.input<typeof modelDefinitionSchema>> = Definition;
export type CheckedModelDefinition = AcceptsEveryDefinition<ModelDefinition>;
