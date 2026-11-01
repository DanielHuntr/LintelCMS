import { z } from "zod";
import { handleSchema } from "../http/handle.schema.js";
import type { FieldMessages } from "../http/http-errors.js";
import type { FieldDefinition } from "./field-definition.schema.js";
import { type CheckFieldValues, defineFieldtype, type NestedCheckResult } from "./fieldtype.js";

/**
 * Fields that hold other fields:
 *
 *   group     { "street": "1 High St", "town": "Leeds" }               one set of fields
 *   repeater  [{ "id": "r1", "data": { "name": "Ada" } }, ...]          rows of the same fields
 *   fieldset  { "meta_title": "...", "meta_description": "..." }        a saved set, reused
 *
 * Their fields are ordinary field definitions, checked like a blueprint's own when the
 * blueprint is saved (`checkInnerFields`), and their values like an entry's
 * (`checkNestedValues`), conditions included: a field in a row can depend on another in the
 * same row, or on the entry's own fields with "$parent." or "$root.".
 *
 * A fieldset field keeps a copy of the saved fieldset's fields in its options, refreshed by
 * src/fieldsets whenever the fieldset or the blueprint is saved, so everything that reads
 * fields (the editor, the API, GraphQL) treats it exactly like a group.
 */

// Each field is checked in full by checkInnerFields, which replaces these with the checked
// definitions; until then only "is it an object" is known.
const innerFieldsSchema = z.array(
  z.custom<FieldDefinition>((candidate) => typeof candidate === "object" && candidate !== null),
  { error: "The fields should be a list" },
);

const rowCountSchema = (what: string) =>
  z
    .number({ error: `The ${what} rows should be a number` })
    .int({ error: `The ${what} rows should be a whole number` })
    .positive({ error: `The ${what} rows should be more than 0` })
    .optional();

export interface FieldsOptions {
  fields: FieldDefinition[];
}

const groupValueSchema = (label: string) =>
  z.record(z.string(), z.unknown(), { error: `${label} should be a set of values` });

/** Checks a group's (or fieldset's) values, with messages keyed by the inner handle. */
async function checkGroupValues(
  value: unknown,
  fields: readonly FieldDefinition[],
  label: string,
  checkFieldValues: CheckFieldValues,
): Promise<NestedCheckResult> {
  const checked = await checkFieldValues(fields, value as Record<string, unknown>);
  const messages: FieldMessages = { ...checked.messages };
  const [first] = Object.values(checked.messages);
  if (first) {
    messages[""] = `${label}: ${first}`;
  }
  return { value: checked.values, messages };
}

export const groupFieldtype = defineFieldtype({
  type: "group",
  name: "Group",
  description: "A few fields kept together under one name, such as an address.",
  category: "structure",
  keywords: ["fieldgroup", "object", "nested", "address", "cluster"],
  optionsSchema: z.object({
    fields: innerFieldsSchema.min(1, { error: "A group needs at least one field" }),
  }),
  buildValueSchema: (_options, label) => groupValueSchema(label),
  isEmpty: (value) => isObjectWithoutValues(value),
  checkInnerFields: (options, checkFieldList) => {
    const checked = checkFieldList(options.fields, "The group");
    return "problem" in checked ? checked : { options: { ...options, fields: checked.fields } };
  },
  checkNestedValues: (value, { fields }, label, checkFieldValues) =>
    checkGroupValues(value, fields, label, checkFieldValues),
});

const rowSchema = z.object({
  id: z.string().trim().min(1).max(100),
  data: z.record(z.string(), z.unknown()).default({}),
});

export type RepeaterRow = z.output<typeof rowSchema>;

export const repeaterFieldtype = defineFieldtype({
  type: "repeater",
  name: "Repeater",
  description: "Rows of the same few fields, such as the speakers at an event or a price list.",
  category: "structure",
  keywords: ["grid", "rows", "repeatable", "collection", "list of", "array", "loop"],
  optionsSchema: z
    .object({
      fields: innerFieldsSchema.min(1, { error: "A repeater needs at least one field" }),
      minRows: rowCountSchema("fewest"),
      maxRows: rowCountSchema("most"),
      /** The add button's words, such as "Add a speaker". Empty for "Add a row". */
      addLabel: z.string({ error: "The add button's words should be text" }).max(60).default(""),
    })
    .refine(
      ({ minRows, maxRows }) =>
        minRows === undefined || maxRows === undefined || minRows <= maxRows,
      { error: "The fewest rows can't be more than the most rows" },
    ),
  buildValueSchema: ({ minRows, maxRows }, label) =>
    z
      .array(rowSchema, { error: `${label} should be a list of rows` })
      .refine((rows) => new Set(rows.map((row) => row.id)).size === rows.length, {
        error: `Two rows in ${label} have the same id`,
      })
      .refine((rows) => minRows === undefined || rows.length >= minRows, {
        error: `${label} needs at least ${minRows} rows`,
      })
      .refine((rows) => maxRows === undefined || rows.length <= maxRows, {
        error: `${label} can have at most ${maxRows} rows`,
      }),
  checkInnerFields: (options, checkFieldList) => {
    const checked = checkFieldList(options.fields, "The repeater");
    return "problem" in checked ? checked : { options: { ...options, fields: checked.fields } };
  },
  checkNestedValues: async (value, { fields }, label, checkFieldValues) => {
    const rows = value as RepeaterRow[];
    const kept: RepeaterRow[] = [];
    const messages: FieldMessages = {};
    const summaries: string[] = [];
    for (const [index, row] of rows.entries()) {
      const checked = await checkFieldValues(fields, row.data);
      const problems = Object.entries(checked.messages);
      for (const [handle, message] of problems) {
        messages[`${row.id}.${handle}`] = message;
      }
      if (problems[0]) {
        summaries.push(`${label} (row ${index + 1}): ${problems[0][1]}`);
      }
      kept.push({ id: row.id, data: checked.values });
    }
    const [firstSummary, ...otherSummaries] = summaries;
    if (firstSummary) {
      messages[""] =
        otherSummaries.length === 0
          ? firstSummary
          : `${firstSummary}, and ${otherSummaries.length} more in ${label}`;
    }
    return { value: kept, messages };
  },
});

export const fieldsetFieldtype = defineFieldtype({
  type: "fieldset",
  name: "Fieldset",
  description:
    "A saved set of fields reused across content types, such as SEO or a call to action.",
  category: "structure",
  keywords: ["import", "reuse", "partial", "shared fields", "template", "seo"],
  optionsSchema: z.object({
    fieldset: handleSchema("Choose which fieldset to use"),
    // A copy of the fieldset's fields, kept up to date by src/fieldsets.
    fields: innerFieldsSchema.default([]),
  }),
  buildValueSchema: (_options, label) => groupValueSchema(label),
  isEmpty: (value) => isObjectWithoutValues(value),
  checkInnerFields: (options, checkFieldList) => {
    const checked = checkFieldList(options.fields, `The fieldset "${options.fieldset}"`);
    return "problem" in checked ? checked : { options: { ...options, fields: checked.fields } };
  },
  checkNestedValues: (value, { fields }, label, checkFieldValues) =>
    checkGroupValues(value, fields, label, checkFieldValues),
});

/** A group with nothing filled in counts as empty, so a required group asks for something. */
function isObjectWithoutValues(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every(
    (inner) =>
      inner === null ||
      inner === undefined ||
      (typeof inner === "string" && inner.trim() === "") ||
      (Array.isArray(inner) && inner.length === 0),
  );
}
