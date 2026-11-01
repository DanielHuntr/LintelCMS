import { z } from "zod";
import { handleSchema } from "../http/handle.schema.js";

/**
 * The fields a form can have, in one visible list, and the shape of each one's settings.
 * The admin's builder, the public API and the server-side checks all read these.
 *
 * A `step` is not a question: it starts a new step of a multi-step form, and its label is
 * the step's title. A form without steps is shown all at once.
 */
export const formFieldTypes = [
  "shortText",
  "longText",
  "email",
  "phone",
  "number",
  "choice",
  "checkboxes",
  "dropdown",
  "date",
  "file",
  "consent",
  "hidden",
  "step",
] as const;

export type FormFieldType = (typeof formFieldTypes)[number];

/** What a file field may accept. Each maps onto the media library's kinds of file. */
export const fileKinds = ["images", "documents"] as const;
export type FileKind = (typeof fileKinds)[number];

/** The media library's own limit; a form can only ask for less. */
export const MAX_FILE_MEGABYTES = 25;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const optionalCount = (what: string, most: number) =>
  z
    .number({ error: `${what} should be a number` })
    .int({ error: `${what} should be a whole number` })
    .min(0, { error: `${what} can't be below 0` })
    .max(most, { error: `${what} can be at most ${most}` })
    .optional();

const optionalDate = (what: string) =>
  z
    .string()
    .regex(DATE_PATTERN, { error: `${what} should look like 2026-12-31` })
    .optional();

const choicesSchema = z
  .array(
    z
      .string({ error: "Each choice should be text" })
      .trim()
      .min(1, { error: "A choice can't be empty" })
      .max(200, { error: "Choices can be at most 200 characters" }),
    { error: "Choices should be a list" },
  )
  .min(1, { error: "Add at least one choice" })
  .max(100, { error: "A field can have at most 100 choices" })
  .refine((choices) => new Set(choices).size === choices.length, {
    error: "Each choice needs to be different",
  });

const textOptions = (longest: number) =>
  z
    .object({
      minLength: optionalCount("The shortest answer", longest),
      maxLength: optionalCount("The longest answer", longest),
    })
    .refine(
      ({ minLength, maxLength }) =>
        minLength === undefined || maxLength === undefined || minLength <= maxLength,
      { error: "The shortest answer can't be longer than the longest" },
    );

const noOptions = z.object({});

/** Each type's own settings. Unknown settings are dropped, so old ones never linger. */
export const formFieldOptionSchemas = {
  shortText: textOptions(1000),
  longText: textOptions(10000),
  email: noOptions,
  phone: noOptions,
  number: z
    .object({
      min: z.number({ error: "The lowest number should be a number" }).optional(),
      max: z.number({ error: "The highest number should be a number" }).optional(),
      wholeNumber: z.boolean().default(false),
    })
    .refine(({ min, max }) => min === undefined || max === undefined || min <= max, {
      error: "The lowest number can't be above the highest",
    }),
  choice: z.object({ choices: choicesSchema }),
  checkboxes: z.object({ choices: choicesSchema }),
  dropdown: z.object({ choices: choicesSchema }),
  date: z
    .object({
      earliest: optionalDate("The earliest date"),
      latest: optionalDate("The latest date"),
    })
    .refine(
      ({ earliest, latest }) =>
        earliest === undefined || latest === undefined || earliest <= latest,
      { error: "The earliest date can't be after the latest" },
    ),
  file: z.object({
    allowedKinds: z
      .array(z.enum(fileKinds, { error: "Files can be images or documents" }))
      .min(1, { error: "Choose which kinds of file people can send" })
      .default(["images", "documents"]),
    maxMegabytes: z
      .number({ error: "The largest file size should be a number" })
      .positive({ error: "The largest file size should be more than 0" })
      .max(MAX_FILE_MEGABYTES, { error: `Files can be at most ${MAX_FILE_MEGABYTES} MB` })
      .default(10),
    maxFiles: z
      .number({ error: "The most files should be a number" })
      .int({ error: "The most files should be a whole number" })
      .min(1, { error: "Allow at least one file" })
      .max(10, { error: "A field can take at most 10 files" })
      .default(1),
  }),
  consent: noOptions,
  hidden: z.object({
    defaultValue: z
      .string()
      .max(1000, { error: "Hidden values can be at most 1000 characters" })
      .default(""),
  }),
  step: noOptions,
} satisfies Record<FormFieldType, z.ZodType>;

export type FormFieldOptions<Type extends FormFieldType> = z.output<
  (typeof formFieldOptionSchemas)[Type]
>;

const fieldBaseSchema = z.object({
  /** Made by the builder when the field is added; never changes, so lists can follow it. */
  id: z.string({ error: "Each field needs an id" }).trim().min(1).max(100),
  type: z.enum(formFieldTypes, {
    error: `A field's type should be one of: ${formFieldTypes.join(", ")}`,
  }),
  /** The name answers are stored and sent under, such as `email`. */
  handle: handleSchema("Each field needs a handle"),
  label: z
    .string({ error: "Each field needs a label" })
    .trim()
    .min(1, { error: "Each field needs a label" })
    .max(500, { error: "Labels can be at most 500 characters" }),
  helpText: z
    .string()
    .trim()
    .max(500, { error: "Help text can be at most 500 characters" })
    .default(""),
  placeholder: z
    .string()
    .trim()
    .max(200, { error: "Placeholders can be at most 200 characters" })
    .default(""),
  required: z.boolean({ error: "Required should be true or false" }).default(false),
  options: z.record(z.string(), z.unknown()).default({}),
});

/** One field, with `options` checked against its type's own settings. */
export const formFieldSchema = fieldBaseSchema.transform((field, context) => {
  const parsed = formFieldOptionSchemas[field.type].safeParse(field.options);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      context.addIssue({ code: "custom", message: `${field.label}: ${issue.message}` });
    }
    return z.NEVER;
  }
  // A step and a hidden value are never "required" of the visitor.
  const required = field.type === "step" || field.type === "hidden" ? false : field.required;
  return { ...field, required, options: parsed.data as Record<string, unknown> };
});

export type FormField = z.output<typeof formFieldSchema>;

export const formFieldListSchema = z
  .array(formFieldSchema, { error: "Fields should be a list" })
  .max(100, { error: "A form can have at most 100 fields" })
  .superRefine((fields, context) => {
    const handles = new Set<string>();
    const ids = new Set<string>();
    for (const field of fields) {
      if (handles.has(field.handle)) {
        context.addIssue({
          code: "custom",
          message: `Two fields have the handle "${field.handle}". Each needs its own.`,
        });
      }
      if (ids.has(field.id)) {
        context.addIssue({ code: "custom", message: `Two fields have the id "${field.id}".` });
      }
      handles.add(field.handle);
      ids.add(field.id);
    }
  });

/** The fields that collect an answer: everything except step breaks. */
export function answerFields(fields: readonly FormField[]): FormField[] {
  return fields.filter((field) => field.type !== "step");
}

export function optionsOf<Type extends FormFieldType>(
  field: FormField,
  type: Type,
): FormFieldOptions<Type> {
  return formFieldOptionSchemas[type].parse(field.options) as FormFieldOptions<Type>;
}
