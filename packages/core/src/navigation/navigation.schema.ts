import { z } from "zod";
import { entryStatuses } from "../entries/entries.table.js";
import { handleSchema } from "../http/handle.schema.js";

/**
 * One item of a menu. It links either to an entry (`entryId`), so its address follows the
 * entry's slug, or to an address typed by hand (`url`), never both. An entry link may
 * leave `label` empty to use the entry's title.
 */
export interface NavigationItem {
  id: string;
  label: string;
  entryId: string | null;
  url: string | null;
  newTab: boolean;
  children: NavigationItem[];
}

/** Web addresses, email and phone links, and addresses on this site. Same rule as link fields. */
const safeLinkPattern = /^(https?:\/\/|mailto:|tel:|\/|#)/i;

export const navigationItemSchema = z.object({
  id: z.uuid({ error: "Each menu item needs an id" }),
  label: z
    .string({ error: "Menu item labels should be text" })
    .trim()
    .max(100, { error: "Menu item labels can be at most 100 characters" })
    .default(""),
  entryId: z
    .uuid({ error: "A menu item should link to an entry by its id" })
    .nullable()
    .default(null),
  url: z
    .string({ error: "A menu item's address should be text" })
    .trim()
    .regex(safeLinkPattern, { error: "Addresses should start with https://, mailto:, tel: or /" })
    .nullable()
    .default(null),
  newTab: z.boolean({ error: "newTab should be true or false" }).default(false),
  get children(): z.ZodDefault<z.ZodArray<typeof navigationItemSchema>> {
    return z.array(navigationItemSchema, { error: "Children should be a list" }).default([]);
  },
});

const navigationNameSchema = z
  .string({ error: "Please give the menu a name" })
  .trim()
  .min(1, { error: "Please give the menu a name" })
  .max(100, { error: "Names can be at most 100 characters" });

const maxDepthSchema = z
  .number({ error: "The number of levels should be a number" })
  .int({ error: "The number of levels should be a whole number" })
  .min(1, { error: "A menu needs at least 1 level" })
  .max(5, { error: "A menu can have at most 5 levels" });

/** `POST /navigation` */
export const createNavigationRequestSchema = z.object({
  handle: handleSchema("Please give the menu a handle"),
  name: navigationNameSchema,
  maxDepth: maxDepthSchema.default(3),
});

/** `PUT /navigation/:handle`. Anything left out stays as it is; `items` replaces the tree. */
export const updateNavigationRequestSchema = z.object({
  name: navigationNameSchema.optional(),
  maxDepth: maxDepthSchema.optional(),
  items: z.array(navigationItemSchema, { error: "Please send the items as a list" }).optional(),
});

export const navigationParamsSchema = z.object({ handle: z.string() });

/** A menu in a list. */
export const navigationSummarySchema = z.object({
  id: z.uuid(),
  handle: z.string(),
  name: z.string(),
  maxDepth: z.number().int(),
  itemCount: z.number().int(),
  updatedAt: z.iso.datetime(),
});

/** An entry a menu links to, as the admin shows it next to the item. */
export const linkedEntrySchema = z.object({
  title: z.string(),
  collectionHandle: z.string(),
  status: z.enum(entryStatuses),
});

/** A whole menu, as the admin edits it. */
export const navigationSchema = navigationSummarySchema.extend({
  items: z.array(navigationItemSchema),
  /** The entries the items link to, by id. Missing ids are entries that were deleted. */
  linkedEntries: z.record(z.string(), linkedEntrySchema),
});

/** A menu item as websites get it: a label and an address, ready to print. */
export interface DeliveredNavigationItem {
  label: string;
  url: string | null;
  newTab: boolean;
  entryId: string | null;
  children: DeliveredNavigationItem[];
}

export type CreateNavigationRequest = z.infer<typeof createNavigationRequestSchema>;
export type UpdateNavigationRequest = z.infer<typeof updateNavigationRequestSchema>;
export type NavigationSummaryResponse = z.infer<typeof navigationSummarySchema>;
export type NavigationResponse = z.infer<typeof navigationSchema>;
export type LinkedEntry = z.infer<typeof linkedEntrySchema>;
