import { z } from "zod";
import { entryStatuses } from "../entries/entries.table.js";

/** An empty query value (`?search=`) means it isn't used. */
function optionalQueryValue<Schema extends z.ZodType>(schema: Schema) {
  return z.preprocess((value) => (value === "" ? undefined : value), schema.optional());
}

/** Which site and language the tree shows. Both default to the main site and its language. */
const siteQuery = {
  siteId: optionalQueryValue(z.uuid({ error: "siteId should be a site id" })),
  locale: optionalQueryValue(z.string().max(35)),
};

/** `GET /content-tree` */
export const treeRootsQuerySchema = z.object(siteQuery);

/** The most children one request returns; the tree asks for more as people scroll. */
export const MAX_CHILDREN_PER_REQUEST = 200;

/**
 * `GET /content-tree/children`: the children of one entry (`parentId`), or the top level of
 * one collection (`collection`), a page at a time.
 */
export const treeChildrenQuerySchema = z
  .object({
    ...siteQuery,
    parentId: optionalQueryValue(z.uuid({ error: "parentId should be an entry id" })),
    collection: optionalQueryValue(z.string().max(64)),
    offset: z.coerce.number({ error: "offset should be a number" }).int().min(0).default(0),
    limit: z.coerce
      .number({ error: "limit should be a number" })
      .int()
      .min(1, { error: "limit should be at least 1" })
      .max(MAX_CHILDREN_PER_REQUEST, {
        error: `limit can be at most ${MAX_CHILDREN_PER_REQUEST}`,
      })
      .default(100),
  })
  .refine((query) => (query.parentId === undefined) !== (query.collection === undefined), {
    error: "Send either parentId or collection",
  });

/**
 * `GET /content-tree/items`: the collection view in the workspace. The entries at one place
 * (an entry's children, or a collection's top level), searched, filtered, sorted and paged.
 * `sort` is "title", "updated", "status", "published" or "field:<handle>" for a list column.
 */
export const collectionItemsQuerySchema = z
  .object({
    ...siteQuery,
    parentId: optionalQueryValue(z.uuid({ error: "parentId should be an entry id" })),
    collection: optionalQueryValue(z.string().max(64)),
    search: optionalQueryValue(z.string().trim().max(200)),
    status: optionalQueryValue(
      z.enum(entryStatuses, { error: 'The status should be "draft", "published" or "scheduled"' }),
    ),
    sort: optionalQueryValue(
      z.string().regex(/^(title|updated|status|published|field:[a-z][a-z0-9_]*)$/, {
        error: 'Sort by "title", "updated", "status", "published" or "field:<handle>"',
      }),
    ),
    direction: optionalQueryValue(z.enum(["asc", "desc"])),
    page: z.coerce.number({ error: "The page should be a number" }).int().min(1).default(1),
    perPage: z.coerce
      .number({ error: "perPage should be a number" })
      .int()
      .min(1)
      .max(100, { error: "perPage can be at most 100" })
      .default(25),
  })
  .refine((query) => (query.parentId === undefined) !== (query.collection === undefined), {
    error: "Send either parentId or collection",
  });

export type CollectionItemsQuery = z.infer<typeof collectionItemsQuerySchema>;

/** `GET /content-tree/search` */
export const treeSearchQuerySchema = z.object({
  ...siteQuery,
  search: z.string({ error: "Type something to search for" }).trim().min(1).max(200),
});

/** `GET /content-tree/allowed-types`: what can be created under an entry, or at a collection's top. */
export const allowedTypesQuerySchema = z
  .object({
    parentId: optionalQueryValue(z.uuid({ error: "parentId should be an entry id" })),
    collection: optionalQueryValue(z.string().max(64)),
  })
  .refine((query) => !(query.parentId !== undefined && query.collection !== undefined), {
    error: "Send parentId or collection, not both",
  });

/** A page whose address a move changed, for offering a redirect from the old one. */
export interface AddressChange {
  entryId: string;
  title: string;
  from: string;
  to: string;
}

/** `POST /content-tree/move`: put an entry under `parentId` (null: its collection's top level), at `index`. */
export const moveEntryRequestSchema = z.object({
  entryId: z.uuid({ error: "entryId should be an entry id" }),
  parentId: z.uuid({ error: "The parent should be an entry id" }).nullable(),
  /** Its place among its new siblings, from 0. Past the end means last. */
  index: z.number({ error: "index should be a number" }).int().min(0),
});

/** `POST /content-tree/sort`: the children of one parent (or one collection's top), in this order. */
export const sortChildrenRequestSchema = z
  .object({
    parentId: z.uuid({ error: "parentId should be an entry id" }).nullable(),
    collection: z.string().max(64).optional(),
    siteId: z.uuid().optional(),
    locale: z.string().max(35).optional(),
    order: z
      .array(z.uuid({ error: "Each item should be an entry id" }))
      .min(1, { error: "Send the entries in the order you want" })
      .max(5000, { error: "Sort at most 5000 entries at once" }),
  })
  .refine((request) => request.parentId !== null || request.collection !== undefined, {
    error: "Name the collection when sorting its top level",
  });

/** `POST /content-tree/entries/:id/publish` and `.../unpublish`, and duplicating. */
export const withDescendantsRequestSchema = z.object({
  includeDescendants: z.boolean().default(false),
});

/** `POST /content-tree/bulk`: what the collection view's bulk actions send. */
export const bulkActionRequestSchema = z.object({
  action: z.enum(["publish", "unpublish", "move", "recycle"], {
    error: 'The action should be "publish", "unpublish", "move" or "recycle"',
  }),
  entryIds: z
    .array(z.uuid({ error: "Each item should be an entry id" }))
    .min(1, { error: "Pick at least one entry" })
    .max(500, { error: "Pick at most 500 entries at once" }),
  /** For "move": the new parent, or null for the top level. */
  parentId: z.uuid().nullable().optional(),
});

export const treeEntryParamsSchema = z.object({ id: z.uuid() });

/** One entry in the tree: enough to draw a row with its status, icon and children. */
export const treeNodeSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  slug: z.string(),
  status: z.enum(entryStatuses),
  /** Saved since it was last published: the site still shows the older version. */
  hasUnpublishedChanges: z.boolean(),
  scheduledFor: z.iso.datetime().nullable(),
  updatedAt: z.iso.datetime(),
  parentId: z.uuid().nullable(),
  locale: z.string(),
  collection: z.object({ handle: z.string(), name: z.string() }),
  childCount: z.number().int(),
  /** Its children are shown as a list in the workspace instead of in the tree. */
  childrenAsCollection: z.boolean(),
  /** At the top of a page tree: a site start, which "Hostnames" can give a domain or path. */
  isSiteStart: z.boolean(),
});

export type TreeNode = z.infer<typeof treeNodeSchema>;
export type TreeChildrenQuery = z.infer<typeof treeChildrenQuerySchema>;
export type MoveEntryRequest = z.infer<typeof moveEntryRequestSchema>;
export type SortChildrenRequest = z.infer<typeof sortChildrenRequestSchema>;
export type BulkActionRequest = z.infer<typeof bulkActionRequestSchema>;

/** A collection that can be made at some place in the tree. */
export interface AllowedType {
  handle: string;
  name: string;
  blueprintHandle: string;
  structure: string;
}

/** A top-level section of the tree: one collection. */
export interface TreeRoot {
  handle: string;
  name: string;
  blueprintHandle: string;
  structure: string;
  /** Entries at its top level, in the site and language shown. */
  childCount: number;
  /** Shown as a list in the workspace (dated and flat collections always are). */
  childrenAsCollection: boolean;
}

export interface TreeRootsResponse {
  sites: { id: string; name: string; locale: string }[];
  site: { id: string; name: string; locale: string };
  locale: string;
  roots: TreeRoot[];
  /** Pages at the top of a page tree; with none, the admin offers to create the home page. */
  siteStartCount: number;
  recycleBinCount: number;
}

export interface PathStep {
  id: string;
  title: string;
  collection: { handle: string; name: string };
}

/** What a publish, unpublish or bulk action did, and what it had to leave out and why. */
export interface BatchResult {
  changed: string[];
  skipped: { id: string; title: string; reason: string }[];
}
