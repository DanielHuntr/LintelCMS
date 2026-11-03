import { isPageLinkHref } from "@lintel/builder-model";
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

/** A list of choices for any field that offers them (select, radio, checkboxes...). */
export function choicesSchema(fieldName: string) {
  return z
    .array(choiceSchema, { error: `${fieldName} needs a list of choices` })
    .min(1, { error: `${fieldName} needs at least one choice` })
    .refine((choices) => new Set(choices.map((choice) => choice.value)).size === choices.length, {
      error: "Each choice needs a different value",
    });
}

export type Choice = z.output<typeof choiceSchema>;

/** One of the choices' values; the message lists their labels. */
export function oneChoiceSchema(choices: readonly Choice[], label: string) {
  const values = choices.map((choice) => choice.value);
  const listed = choices.map((choice) => choice.label).join(", ");
  return z
    .string({ error: `${label} should be one of: ${listed}` })
    .refine((value) => values.includes(value), { error: `${label} should be one of: ${listed}` });
}

const selectOptionsSchema = z.object({
  choices: choicesSchema("A select field"),
  multiple: z.boolean({ error: "multiple should be true or false" }).default(false),
});

export const selectFieldtype = defineFieldtype({
  type: "select",
  name: "Select",
  description: "A choice from a list you set up, such as a category. Can allow several.",
  category: "choices",
  keywords: ["dropdown", "drop-down", "menu", "options", "picker", "list"],
  optionsSchema: selectOptionsSchema,
  buildValueSchema: ({ choices, multiple }, label) => {
    const oneChoice = oneChoiceSchema(choices, label);
    return multiple
      ? z.array(oneChoice, { error: `${label} should be a list of choices` })
      : oneChoice;
  },
});

export const imageFieldtype = defineFieldtype({
  type: "image",
  name: "Image",
  description: "A picture from the media library.",
  category: "media",
  keywords: ["picture", "photo", "asset", "upload", "file"],
  optionsSchema: z.object({}),
  buildValueSchema: (_options, label) =>
    z.uuid({ error: `${label} should be an image from the media library` }),
  checkReferences: async (value, label, context) =>
    typeof value === "string" && (await context.assetExists(value))
      ? null
      : `The image chosen for ${label} is no longer in the media library`,
});

/**
 * Web addresses, email and phone links, links within the site ("/about", "#team"), and a
 * page chosen with "Choose a page…", stored by its id (`lintel:page/<id>`, see page-links).
 */
const safeLinkPattern = /^(https?:\/\/|mailto:|tel:|\/|#)/i;
const isSafeLink = (url: string) => safeLinkPattern.test(url) || isPageLinkHref(url);

export const linkFieldtype = defineFieldtype({
  type: "link",
  name: "Link",
  description: "A link to a web page, an email address or a page on this site.",
  category: "relationships",
  keywords: ["href", "button", "anchor", "url"],
  optionsSchema: z.object({}),
  buildValueSchema: (_options, label) =>
    z.object(
      {
        url: z
          .string({ error: `${label} needs an address` })
          .trim()
          .refine(isSafeLink, {
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
