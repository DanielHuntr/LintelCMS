import { z } from "zod";
import { handleSchema } from "../http/handle.schema.js";
import { acceptAnyReference } from "./content-references.js";
import { defineFieldtype } from "./fieldtype.js";

/**
 * Fieldtypes that link to other content: entries (related posts, the team members on a
 * page) and taxonomy terms (a post's categories and tags). Both store a list of ids, in
 * the order the editor chose, even when only one is allowed, so code reading them never
 * has to ask which shape it got.
 */

const maxItemsSchema = z
  .number({ error: "The most that can be chosen should be a number" })
  .int({ error: "The most that can be chosen should be a whole number" })
  .positive({ error: "The most that can be chosen should be more than 0" })
  .optional();

function idListSchema(label: string, kind: string, maxItems: number | undefined) {
  const ids = z
    .array(z.uuid({ error: `${label} should be a list of ${kind}` }), {
      error: `${label} should be a list of ${kind}`,
    })
    .refine((list) => new Set(list).size === list.length, {
      error: `${label} lists the same one twice`,
    });
  if (maxItems === undefined) {
    return ids;
  }
  const most = maxItems === 1 ? `only 1` : `at most ${maxItems}`;
  return ids.refine((list) => list.length <= maxItems, {
    error: `${label} can have ${most}`,
  });
}

export const termsFieldtype = defineFieldtype({
  type: "terms",
  name: "Categories or tags",
  description: "Terms from a taxonomy you set up, such as a post's categories or tags.",
  optionsSchema: z.object({
    taxonomy: handleSchema("Choose which taxonomy the terms come from"),
    maxItems: maxItemsSchema,
  }),
  buildValueSchema: ({ maxItems }, label) => idListSchema(label, "terms", maxItems),
  checkReferences: async (value, label, context, { taxonomy }) => {
    const references = context.references ?? acceptAnyReference;
    const missing = await references.findMissingTermIds(taxonomy, value as string[]);
    return missing.length === 0 ? null : `Some of the terms chosen for ${label} no longer exist`;
  },
});

export const entriesFieldtype = defineFieldtype({
  type: "entries",
  name: "Entries",
  description: "Links to other entries, such as related posts or the people on a team page.",
  optionsSchema: z.object({
    collections: z
      .array(z.string({ error: "Collections should be listed by handle" }), {
        error: "Collections should be a list of handles",
      })
      .default([]),
    maxItems: maxItemsSchema,
  }),
  buildValueSchema: ({ maxItems }, label) => idListSchema(label, "entries", maxItems),
  checkReferences: async (value, label, context, { collections }) => {
    const references = context.references ?? acceptAnyReference;
    const missing = await references.findMissingEntryIds(collections, value as string[]);
    return missing.length === 0
      ? null
      : `Some of the entries chosen for ${label} no longer exist, or can't be chosen here`;
  },
});
