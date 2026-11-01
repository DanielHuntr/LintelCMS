import { z } from "zod";
import { defineFieldtype } from "./fieldtype.js";

/**
 * A list of short pieces of text, such as opening times, ingredients or social links.
 * Blank items are left out, so an empty row an editor added but didn't fill in is ignored.
 */
export const listFieldtype = defineFieldtype({
  type: "list",
  name: "List",
  description: "A list of short items, such as opening times or ingredients.",
  optionsSchema: z.object({
    maxItems: z
      .number({ error: "The most items should be a number" })
      .int({ error: "The most items should be a whole number" })
      .positive({ error: "The most items should be more than 0" })
      .optional(),
  }),
  buildValueSchema: ({ maxItems }, label) => {
    const items = z.array(
      z
        .string({ error: `Each item in ${label} should be text` })
        .trim()
        .max(500, { error: `Items in ${label} can be at most 500 characters` }),
      { error: `${label} should be a list` },
    );
    const limited =
      maxItems === undefined
        ? items
        : items.max(maxItems, { error: `${label} can have at most ${maxItems} items` });
    return z.preprocess(withoutBlankItems, limited);
  },
  isEmpty: (value) => Array.isArray(value) && value.every(isBlankItem),
});

function withoutBlankItems(value: unknown): unknown {
  return Array.isArray(value) ? value.filter((item) => !isBlankItem(item)) : value;
}

function isBlankItem(item: unknown): boolean {
  return typeof item === "string" && item.trim() === "";
}
