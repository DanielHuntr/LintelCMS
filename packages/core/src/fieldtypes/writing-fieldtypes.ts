import { z } from "zod";
import { handleSchema } from "../http/handle.schema.js";
import { defineFieldtype } from "./fieldtype.js";

/** Text with a purpose: a slug made from another field, code, and a value editors don't see. */

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const slugFieldtype = defineFieldtype({
  type: "slug",
  name: "Slug",
  description: "A short, web-friendly name, like summer-fair, made from another field as you type.",
  category: "text",
  keywords: ["permalink", "url name", "handle", "kebab", "path"],
  optionsSchema: z.object({
    /** The field it is made from until someone edits it. */
    from: handleSchema("Choose which field the slug is made from").default("title"),
  }),
  buildValueSchema: (_options, label) =>
    z
      .string({ error: `${label} should be text` })
      .max(200, { error: `${label} can be at most 200 characters` })
      .regex(SLUG_PATTERN, {
        error: `${label} can use lowercase letters, numbers and single hyphens, like summer-fair`,
      }),
});

export const codeLanguages = [
  "plain",
  "html",
  "css",
  "javascript",
  "typescript",
  "json",
  "yaml",
  "markdown",
  "php",
  "python",
  "shell",
  "sql",
] as const;

export const codeFieldtype = defineFieldtype({
  type: "code",
  name: "Code",
  description: "A snippet of code, such as an embed or a tracking script, kept exactly as typed.",
  category: "advanced",
  keywords: ["snippet", "embed", "html", "script", "css", "json", "monospace"],
  optionsSchema: z.object({
    language: z
      .enum(codeLanguages, { error: `The language should be one of: ${codeLanguages.join(", ")}` })
      .default("plain"),
    maxLength: z
      .number({ error: "The most characters should be a number" })
      .int({ error: "The most characters should be a whole number" })
      .positive({ error: "The most characters should be more than 0" })
      .optional(),
  }),
  buildValueSchema: ({ maxLength }, label) => {
    const code = z.string({ error: `${label} should be text` });
    const limit = maxLength ?? 100_000;
    return code.max(limit, { error: `${label} can be at most ${limit} characters` });
  },
});

export const hiddenFieldtype = defineFieldtype({
  type: "hidden",
  name: "Hidden value",
  description:
    "A value saved with the entry that editors don't see, set by its default or the API.",
  category: "advanced",
  keywords: ["hidden", "invisible", "internal", "meta", "secret"],
  optionsSchema: z.object({}),
  buildValueSchema: (_options, label) =>
    z
      .union([z.string(), z.number(), z.boolean()], {
        error: `${label} should be text, a number, or true or false`,
      })
      .refine((value) => typeof value !== "string" || value.length <= 2000, {
        error: `${label} can be at most 2000 characters`,
      }),
});
