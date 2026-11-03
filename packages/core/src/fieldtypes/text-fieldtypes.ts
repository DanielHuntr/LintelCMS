import { z } from "zod";
import { defineFieldtype } from "./fieldtype.js";
import {
  isEmptyRichText,
  findRichTextPictureProblem,
  isReadableRichText,
  richTextAssetIds,
  isShallowEnoughRichText,
  MAX_RICH_TEXT_DEPTH,
  type RichTextDocument,
} from "./rich-text.js";

/** Fieldtypes for words: a line of text, a paragraph or two, and formatted rich text. */

const maxLengthOptionsSchema = z.object({
  maxLength: z
    .number({ error: "The maximum length should be a number" })
    .int({ error: "The maximum length should be a whole number" })
    .positive({ error: "The maximum length should be more than 0" })
    .optional(),
});

function textValueSchema(options: z.output<typeof maxLengthOptionsSchema>, label: string) {
  const text = z.string({ error: `${label} should be text` });
  return options.maxLength === undefined
    ? text
    : text.max(options.maxLength, {
        error: `${label} can be at most ${options.maxLength} characters`,
      });
}

export const textFieldtype = defineFieldtype({
  type: "text",
  name: "Text",
  description: "A single line of text, such as a title or a name.",
  category: "text",
  keywords: ["input", "string", "line", "heading", "name"],
  optionsSchema: maxLengthOptionsSchema,
  buildValueSchema: textValueSchema,
});

export const textareaFieldtype = defineFieldtype({
  type: "textarea",
  name: "Text area",
  description: "A few lines of plain text, such as a summary or an excerpt.",
  category: "text",
  keywords: ["paragraph", "multiline", "summary", "excerpt", "plain"],
  optionsSchema: maxLengthOptionsSchema,
  buildValueSchema: textValueSchema,
});

const richTextNodeSchema = z.looseObject({ type: z.string() });

export const richTextFieldtype = defineFieldtype({
  type: "richText",
  name: "Rich text",
  description: "Formatted writing with headings, lists, links, quotes and pictures.",
  category: "text",
  keywords: ["wysiwyg", "editor", "html", "bard", "formatted", "body", "content"],
  optionsSchema: z.object({}),
  buildValueSchema: (_options, label) =>
    z
      .looseObject(
        { type: z.literal("doc"), content: z.array(richTextNodeSchema).optional() },
        { error: `${label} should be a rich text document` },
      )
      // Depth first: a document nested deeply enough overflows the editor's own check.
      .refine((document: RichTextDocument) => isShallowEnoughRichText(document), {
        error: `${label} is nested too deeply: at most ${MAX_RICH_TEXT_DEPTH} levels, such as quotes inside quotes`,
        abort: true,
      })
      .refine((document: RichTextDocument) => isReadableRichText(document), {
        error: `${label} has formatting the editor doesn't recognise`,
        abort: true,
      })
      .superRefine((document: RichTextDocument, context) => {
        const problem = findRichTextPictureProblem(document);
        if (problem) context.addIssue({ code: "custom", message: `${label}: ${problem}` });
      }),
  // A picture must still be in the media library, as an image field's must.
  checkReferences: async (value, label, context) => {
    for (const assetId of richTextAssetIds(value as RichTextDocument)) {
      if (!(await context.assetExists(assetId))) {
        return `A picture in ${label} is no longer in the media library`;
      }
    }
    return null;
  },
  isEmpty: (value) =>
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    value.type === "doc" &&
    isEmptyRichText(value as RichTextDocument),
});
