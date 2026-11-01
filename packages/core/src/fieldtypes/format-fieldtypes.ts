import { z } from "zod";
import { defineFieldtype } from "./fieldtype.js";

/**
 * Fieldtypes for text with a format of its own: an email address, a web address, a colour,
 * and writing in Markdown.
 */

export const emailFieldtype = defineFieldtype({
  type: "email",
  name: "Email",
  description: "An email address, such as the one people should write to.",
  category: "relationships",
  keywords: ["mail", "e-mail", "address", "contact"],
  optionsSchema: z.object({}),
  buildValueSchema: (_options, label) => {
    const message = `${label} should be an email address, like name@example.com`;
    return z
      .string({ error: message })
      .trim()
      .pipe(z.email({ error: message }));
  },
});

export const urlFieldtype = defineFieldtype({
  type: "url",
  name: "Web address",
  description: "The address of a web page, such as a booking page or a profile.",
  category: "relationships",
  keywords: ["link", "website", "web address", "href"],
  optionsSchema: z.object({}),
  buildValueSchema: (_options, label) => {
    const message = `${label} should be a web address starting with https:// or http://`;
    return z
      .string({ error: message })
      .trim()
      .refine((value) => isWebAddress(value), { error: message });
  },
});

function isWebAddress(value: string): boolean {
  if (!/^https?:\/\/\S+$/i.test(value) || !URL.canParse(value)) {
    return false;
  }
  return new URL(value).hostname !== "";
}

/** Six-digit hex, the format colour pickers and CSS both understand. */
const hexColourPattern = /^#[0-9a-f]{6}$/i;

const hexColourSchema = z
  .string({ error: "Each colour should look like #1a2b3c" })
  .regex(hexColourPattern, { error: "Each colour should look like #1a2b3c" })
  .transform((colour) => colour.toLowerCase());

export const colourFieldtype = defineFieldtype({
  type: "colour",
  name: "Colour",
  description: "A colour, such as a brand or background colour. You can suggest a few.",
  category: "media",
  keywords: ["color", "hex", "swatch", "palette"],
  optionsSchema: z.object({
    swatches: z
      .array(hexColourSchema, { error: "Suggested colours should be a list" })
      .max(24, { error: "Suggest at most 24 colours" })
      .default([]),
  }),
  buildValueSchema: (_options, label) =>
    z
      .string({ error: `${label} should be a colour like #1a2b3c` })
      .trim()
      .regex(hexColourPattern, { error: `${label} should be a colour like #1a2b3c` })
      .transform((colour) => colour.toLowerCase()),
});

export const markdownFieldtype = defineFieldtype({
  type: "markdown",
  name: "Markdown",
  description: "Writing in Markdown, for people who like to format with symbols.",
  category: "text",
  keywords: ["md", "formatted", "plain text"],
  optionsSchema: z.object({
    maxLength: z
      .number({ error: "The maximum length should be a number" })
      .int({ error: "The maximum length should be a whole number" })
      .positive({ error: "The maximum length should be more than 0" })
      .optional(),
  }),
  buildValueSchema: ({ maxLength }, label) => {
    const text = z.string({ error: `${label} should be text` });
    return maxLength === undefined
      ? text
      : text.max(maxLength, { error: `${label} can be at most ${maxLength} characters` });
  },
});
