import { z } from "zod";
import { defineFieldtype } from "./fieldtype.js";

/** Fieldtypes that point somewhere: a choice from a list, an image, a link. */

const choiceSchema = z.object({
  value: z
    .string({ error: "Each choice needs a value" })
    .trim()
    .min(1, { error: "Each choice needs a value" }),
  label: z
    .string({ error: "Each choice needs a label" })
    .trim()
    .min(1, { error: "Each choice needs a label" }),
});

const selectOptionsSchema = z.object({
  choices: z
    .array(choiceSchema, { error: "A select field needs a list of choices" })
    .min(1, { error: "A select field needs at least one choice" })
    .refine((choices) => new Set(choices.map((choice) => choice.value)).size === choices.length, {
      error: "Each choice needs a different value",
    }),
  multiple: z.boolean({ error: "multiple should be true or false" }).default(false),
});

export const selectFieldtype = defineFieldtype({
  type: "select",
  name: "Select",
  description: "A choice from a list you set up, such as a category. Can allow several.",
  optionsSchema: selectOptionsSchema,
  buildValueSchema: ({ choices, multiple }, label) => {
    const values = choices.map((choice) => choice.value);
    const listed = choices.map((choice) => choice.label).join(", ");
    const oneChoice = z
      .string({ error: `${label} should be one of: ${listed}` })
      .refine((value) => values.includes(value), { error: `${label} should be one of: ${listed}` });
    return multiple
      ? z.array(oneChoice, { error: `${label} should be a list of choices` })
      : oneChoice;
  },
});

export const imageFieldtype = defineFieldtype({
  type: "image",
  name: "Image",
  description: "A picture from the media library.",
  optionsSchema: z.object({}),
  buildValueSchema: (_options, label) =>
    z.uuid({ error: `${label} should be an image from the media library` }),
  checkReferences: async (value, label, context) =>
    typeof value === "string" && (await context.assetExists(value))
      ? null
      : `The image chosen for ${label} is no longer in the media library`,
});

/** Web addresses, email and phone links, and links within the site ("/about", "#team"). */
const safeLinkPattern = /^(https?:\/\/|mailto:|tel:|\/|#)/i;

export const linkFieldtype = defineFieldtype({
  type: "link",
  name: "Link",
  description: "A link to a web page, an email address or a page on this site.",
  optionsSchema: z.object({}),
  buildValueSchema: (_options, label) =>
    z.object(
      {
        url: z
          .string({ error: `${label} needs an address` })
          .trim()
          .regex(safeLinkPattern, {
            error: `${label} should start with https://, mailto:, tel: or /`,
          }),
        label: z.string({ error: `The text for ${label} should be text` }).optional(),
      },
      { error: `${label} should be a link with an address` },
    ),
  isEmpty: (value) =>
    typeof value === "object" &&
    value !== null &&
    "url" in value &&
    (typeof value.url !== "string" || value.url.trim() === ""),
});
