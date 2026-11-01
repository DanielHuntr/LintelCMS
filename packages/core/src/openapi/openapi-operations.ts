import { z } from "zod";
import { blueprintHandleParamsSchema, blueprintSchema } from "../blueprints/blueprints.schema.js";
import {
  collectionHandleParamsSchema,
  collectionSchema,
} from "../collections/collections.schema.js";
import {
  deliveredEntrySchema,
  deliveredListSchema,
  deliveryEntryParamsSchema,
  deliveryEntryQuerySchema,
  deliveryListParamsSchema,
  deliveryListQuerySchema,
} from "../delivery/delivery.schema.js";
import {
  collectionEntriesParamsSchema,
  createEntryRequestSchema,
  entryIdParamsSchema,
  entryListSchema,
  entrySchema,
  listEntriesQuerySchema,
  reorderEntriesRequestSchema,
  revisionParamsSchema,
  revisionSchema,
  revisionSummarySchema,
  scheduleEntryRequestSchema,
  copyEntryToSiteRequestSchema,
  translateEntryRequestSchema,
  updateEntryRequestSchema,
} from "../entries/entries.schema.js";
import { deliveredGlobalSetSchema, globalSetParamsSchema } from "../globals/globals.schema.js";
import { navigationParamsSchema } from "../navigation/navigation.schema.js";
import { entryPreviewSchema } from "../preview/preview.schema.js";
import { localeQuerySchema } from "../sites/locales.schema.js";
import { deliveredSiteSchema, matchSiteQuerySchema } from "../sites/sites.schema.js";
import {
  taxonomyHandleParamsSchema,
  termSlugParamsSchema,
} from "../taxonomies/taxonomies.schema.js";
import {
  assetIdParamsSchema,
  assetSchema,
  fileTransformQuerySchema,
  listAssetsQuerySchema,
  updateAssetRequestSchema,
} from "../media/media.schema.js";
import { deliveredRedirectListSchema } from "../seo/redirects.schema.js";
import { deliveredEntrySeoParamsSchema, deliveredEntrySeoSchema } from "../seo/seo.schema.js";

/**
 * Every endpoint in the OpenAPI document, in one visible list. Shapes come from the same
 * Zod schemas the routes check requests with, so the document can't drift from the code
 * in what it accepts; openapi.test.ts checks that every content route is listed here.
 *
 * Admin-only endpoints (settings, users, webhooks, API tokens) are left out: they are
 * for the admin app, not for websites and scripts.
 */
export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

/** "public" needs nothing (unless delivery is set to need a token); the rest name a permission. */
export type OperationAccess = "public" | "delivery" | `${string}:${string}`;

export interface OperationResponse {
  description: string;
  schema?: z.ZodType;
  contentType?: string;
}

export interface Operation {
  method: HttpMethod;
  /** In OpenAPI's style, with `{name}` for path parameters. */
  path: string;
  tag: "Delivery" | "SEO" | "Collections" | "Entries" | "Media";
  summary: string;
  description?: string;
  access: OperationAccess;
  params?: z.ZodObject;
  query?: z.ZodObject;
  body?: z.ZodType;
  /** Replaces the JSON body, for uploads. */
  multipartFile?: boolean;
  responses: Record<number, OperationResponse>;
}

const noContent = { description: "Done; nothing to send back." };
const entryResponse = { description: "The entry.", schema: entrySchema };

export const openApiOperations: Operation[] = [
  {
    method: "get",
    path: "/delivery/{collection}",
    tag: "Delivery",
    summary: "List published entries",
    description: "Newest first for dated collections, in the hand-set order for the others.",
    access: "delivery",
    params: deliveryListParamsSchema,
    query: deliveryListQuerySchema,
    responses: { 200: { description: "A page of entries.", schema: deliveredListSchema } },
  },
  {
    method: "get",
    path: "/delivery/{collection}/{slug}",
    tag: "Delivery",
    summary: "Get one published entry",
    description:
      "In the site's main language unless `locale` is sent, with links to its translations. A live-preview token (`preview`, or the `Lintel-Preview` header) for this entry serves its draft instead.",
    access: "delivery",
    params: deliveryEntryParamsSchema,
    query: deliveryEntryQuerySchema,
    responses: {
      200: { description: "The entry.", schema: deliveredEntrySchema },
      401: { description: "The preview token is wrong or has expired." },
      404: { description: "There is no published entry with this slug." },
    },
  },
  {
    method: "get",
    path: "/delivery/locales",
    tag: "Delivery",
    summary: "List the site's languages",
    access: "delivery",
    responses: { 200: { description: "The main language and every language the site has." } },
  },
  {
    method: "get",
    path: "/delivery/sites",
    tag: "Delivery",
    summary: "List every site",
    description:
      "For routing and language or country switchers on websites that serve several sites.",
    access: "public",
    responses: {
      200: {
        description: "Every site, the main one first.",
        schema: z.object({ sites: z.array(deliveredSiteSchema) }),
      },
    },
  },
  {
    method: "get",
    path: "/delivery/site",
    tag: "Delivery",
    summary: "Get the site this request is for",
    description:
      "Chosen by `?site=<handle>`, the `Lintel-Site` header, or the domain the request came to, else the main site.",
    access: "public",
    responses: {
      200: { description: "The site.", schema: deliveredSiteSchema },
      404: { description: "There is no site with the handle asked for." },
    },
  },
  {
    method: "get",
    path: "/delivery/sites/match",
    tag: "Delivery",
    summary: "Find the site for a page address",
    description:
      "When sites share a domain, the longest path prefix that fits wins. `path` is the address within the site.",
    access: "public",
    query: matchSiteQuerySchema,
    responses: {
      200: {
        description: "The site and the path within it.",
        schema: z.object({ site: deliveredSiteSchema, path: z.string() }),
      },
      404: { description: "No site answers on this address." },
    },
  },
  {
    method: "get",
    path: "/delivery/taxonomies/{handle}",
    tag: "Delivery",
    summary: "Get a taxonomy and its terms",
    access: "delivery",
    params: taxonomyHandleParamsSchema,
    responses: {
      200: { description: "The taxonomy, with its terms in order." },
      404: { description: "There is no taxonomy with this handle." },
    },
  },
  {
    method: "get",
    path: "/delivery/taxonomies/{handle}/{slug}",
    tag: "Delivery",
    summary: "Get one term",
    access: "delivery",
    params: termSlugParamsSchema,
    responses: {
      200: { description: "The term." },
      404: { description: "There is no term with this slug in the taxonomy." },
    },
  },
  {
    method: "get",
    path: "/delivery/globals",
    tag: "Delivery",
    summary: "Get every set of global values",
    description:
      "Values in `locale` where they have been translated, otherwise the main language's.",
    access: "delivery",
    query: localeQuerySchema,
    responses: { 200: { description: "Every global set, keyed by handle." } },
  },
  {
    method: "get",
    path: "/delivery/globals/{handle}",
    tag: "Delivery",
    summary: "Get one set of global values",
    access: "delivery",
    params: globalSetParamsSchema,
    query: localeQuerySchema,
    responses: {
      200: { description: "The global set's values.", schema: deliveredGlobalSetSchema },
      404: { description: "There is no global set with this handle." },
    },
  },
  {
    method: "get",
    path: "/delivery/navigation/{handle}",
    tag: "Delivery",
    summary: "Get a menu",
    description:
      "Links to entries point at their translation in `locale` when there is one; unpublished pages are left out.",
    access: "delivery",
    params: navigationParamsSchema,
    query: localeQuerySchema,
    responses: {
      200: { description: "The menu, as a tree of items." },
      404: { description: "There is no menu with this handle." },
    },
  },
  {
    method: "post",
    path: "/graphql",
    tag: "Delivery",
    summary: "Query content with GraphQL",
    description:
      "Collections, entries and media, typed from your blueprints. Send `{ query, variables }`. Drafts need `preview: true` and a read-write token.",
    access: "delivery",
    body: z.object({
      query: z.string(),
      variables: z.record(z.string(), z.unknown()).optional(),
      operationName: z.string().optional(),
    }),
    responses: { 200: { description: "`{ data, errors }`, as GraphQL always answers." } },
  },
  {
    method: "get",
    path: "/graphql",
    tag: "Delivery",
    summary: "Query content with GraphQL in the address",
    description:
      "The same as POST, for clients that prefer GET. In development this address also opens GraphiQL in a browser.",
    access: "delivery",
    query: z.object({ query: z.string(), variables: z.string().optional() }),
    responses: { 200: { description: "`{ data, errors }`, as GraphQL always answers." } },
  },
  {
    method: "get",
    path: "/delivery/{collection}/{slug}/seo",
    tag: "SEO",
    summary: "Get a published entry's SEO",
    description: "Title, description, image and robots setting, with the site defaults filled in.",
    access: "delivery",
    params: deliveredEntrySeoParamsSchema,
    responses: {
      200: { description: "What to put in the page's <head>.", schema: deliveredEntrySeoSchema },
      404: { description: "No published entry, or SEO tools are switched off." },
    },
  },
  {
    method: "get",
    path: "/delivery/seo-redirects",
    tag: "SEO",
    summary: "List active redirects",
    access: "delivery",
    responses: {
      200: { description: "Every active redirect.", schema: deliveredRedirectListSchema },
    },
  },
  {
    method: "get",
    path: "/sitemap.xml",
    tag: "SEO",
    summary: "The sitemap for search engines",
    access: "public",
    responses: {
      200: { description: "sitemap.xml", contentType: "application/xml" },
      404: { description: "SEO tools are off, or the site's address isn't set yet." },
    },
  },
  {
    method: "get",
    path: "/robots.txt",
    tag: "SEO",
    summary: "robots.txt for search engines",
    access: "public",
    responses: { 200: { description: "robots.txt", contentType: "text/plain" } },
  },
  {
    method: "get",
    path: "/collections",
    tag: "Collections",
    summary: "List collections",
    access: "collections:read",
    responses: {
      200: {
        description: "Every collection.",
        schema: z.object({ collections: z.array(collectionSchema) }),
      },
    },
  },
  {
    method: "get",
    path: "/collections/{handle}",
    tag: "Collections",
    summary: "Get a collection",
    access: "collections:read",
    params: collectionHandleParamsSchema,
    responses: { 200: { description: "The collection.", schema: collectionSchema } },
  },
  {
    method: "get",
    path: "/blueprints/{handle}",
    tag: "Collections",
    summary: "Get a content type's fields",
    access: "blueprints:read",
    params: blueprintHandleParamsSchema,
    responses: { 200: { description: "The content type.", schema: blueprintSchema } },
  },
  {
    method: "get",
    path: "/collections/{handle}/entries",
    tag: "Entries",
    summary: "List entries, drafts included",
    access: "entries:read",
    params: collectionEntriesParamsSchema,
    query: listEntriesQuerySchema,
    responses: { 200: { description: "A page of entries.", schema: entryListSchema } },
  },
  {
    method: "post",
    path: "/collections/{handle}/entries",
    tag: "Entries",
    summary: "Create a draft entry",
    access: "entries:create",
    params: collectionEntriesParamsSchema,
    body: createEntryRequestSchema,
    responses: { 201: entryResponse },
  },
  {
    method: "post",
    path: "/collections/{handle}/entries/reorder",
    tag: "Entries",
    summary: "Change the order of entries",
    access: "entries:update",
    params: collectionEntriesParamsSchema,
    body: reorderEntriesRequestSchema,
    responses: { 204: noContent },
  },
  {
    method: "get",
    path: "/entries/{id}",
    tag: "Entries",
    summary: "Get an entry",
    access: "entries:read",
    params: entryIdParamsSchema,
    responses: { 200: entryResponse },
  },
  {
    method: "patch",
    path: "/entries/{id}",
    tag: "Entries",
    summary: "Save changes to an entry",
    description:
      "`data` is merged over the saved values. A live entry stays as it was until published again.",
    access: "entries:update",
    params: entryIdParamsSchema,
    body: updateEntryRequestSchema,
    responses: { 200: entryResponse },
  },
  {
    method: "delete",
    path: "/entries/{id}",
    tag: "Entries",
    summary: "Delete an entry",
    access: "entries:delete",
    params: entryIdParamsSchema,
    responses: { 204: noContent },
  },
  {
    method: "post",
    path: "/entries/{id}/publish",
    tag: "Entries",
    summary: "Publish an entry's saved values",
    access: "entries:publish",
    params: entryIdParamsSchema,
    responses: {
      200: entryResponse,
      400: {
        description:
          "NOT_READY_TO_PUBLISH: required fields are empty. `fields` has a message for each one.",
      },
    },
  },
  {
    method: "post",
    path: "/entries/{id}/duplicate",
    tag: "Entries",
    summary: "Copy an entry as a new draft",
    access: "entries:create",
    params: entryIdParamsSchema,
    responses: { 201: { description: "The copy, a draft.", schema: entrySchema } },
  },
  {
    method: "post",
    path: "/entries/{id}/copy-to-site",
    tag: "Entries",
    summary: "Copy an entry to another site as a new draft",
    description:
      "The copy isn't linked to the original. Entries of shared collections can't be copied.",
    access: "entries:create",
    params: entryIdParamsSchema,
    body: copyEntryToSiteRequestSchema,
    responses: {
      201: { description: "The copy, a draft on the other site.", schema: entrySchema },
      403: { description: "You can't work on that site." },
      404: {
        description: "There is no such entry or site, or the site doesn't use the collection.",
      },
    },
  },
  {
    method: "post",
    path: "/entries/{id}/translations",
    tag: "Entries",
    summary: "Start a translation of an entry",
    access: "entries:create",
    params: entryIdParamsSchema,
    body: translateEntryRequestSchema,
    responses: {
      201: { description: "The new translation, a draft.", schema: entrySchema },
      409: { description: "TRANSLATION_EXISTS: the entry already has one in that language." },
    },
  },
  {
    method: "post",
    path: "/entries/{id}/preview",
    tag: "Entries",
    summary: "Make a live-preview link for an entry's draft",
    description:
      "The token lasts 30 minutes and shows only this entry's draft, through the delivery API or GraphQL.",
    access: "entries:read",
    params: entryIdParamsSchema,
    responses: {
      200: { description: "The token and when it expires.", schema: entryPreviewSchema },
    },
  },
  {
    method: "post",
    path: "/entries/{id}/unpublish",
    tag: "Entries",
    summary: "Take an entry off the site",
    access: "entries:publish",
    params: entryIdParamsSchema,
    responses: { 200: entryResponse },
  },
  {
    method: "post",
    path: "/entries/{id}/schedule",
    tag: "Entries",
    summary: "Publish an entry later",
    access: "entries:publish",
    params: entryIdParamsSchema,
    body: scheduleEntryRequestSchema,
    responses: { 200: entryResponse },
  },
  {
    method: "get",
    path: "/entries/{id}/revisions",
    tag: "Entries",
    summary: "List an entry's revisions",
    access: "entries:read",
    params: entryIdParamsSchema,
    responses: {
      200: {
        description: "Newest first.",
        schema: z.object({ revisions: z.array(revisionSummarySchema) }),
      },
    },
  },
  {
    method: "get",
    path: "/entries/{id}/revisions/{revisionId}",
    tag: "Entries",
    summary: "Get one revision with its values",
    access: "entries:read",
    params: revisionParamsSchema,
    responses: { 200: { description: "The revision.", schema: revisionSchema } },
  },
  {
    method: "post",
    path: "/entries/{id}/revisions/{revisionId}/restore",
    tag: "Entries",
    summary: "Restore a revision as the saved values",
    access: "entries:update",
    params: revisionParamsSchema,
    responses: { 200: entryResponse },
  },
  {
    method: "get",
    path: "/media",
    tag: "Media",
    summary: "List the media library",
    access: "media:read",
    query: listAssetsQuerySchema,
    responses: {
      200: {
        description: "A page of assets.",
        schema: z.object({ assets: z.array(assetSchema), total: z.number().int() }),
      },
    },
  },
  {
    method: "post",
    path: "/media",
    tag: "Media",
    summary: "Upload a file",
    description: "Send the file as multipart form data, in a field called `file`.",
    access: "media:upload",
    multipartFile: true,
    responses: {
      201: { description: "The new asset.", schema: assetSchema },
      200: { description: "The same file was already uploaded; here it is.", schema: assetSchema },
    },
  },
  {
    method: "get",
    path: "/media/{id}",
    tag: "Media",
    summary: "Get an asset",
    access: "media:read",
    params: assetIdParamsSchema,
    responses: { 200: { description: "The asset.", schema: assetSchema } },
  },
  {
    method: "patch",
    path: "/media/{id}",
    tag: "Media",
    summary: "Change an asset's alt text, focal point or filename",
    access: "media:update",
    params: assetIdParamsSchema,
    body: updateAssetRequestSchema,
    responses: { 200: { description: "The asset.", schema: assetSchema } },
  },
  {
    method: "delete",
    path: "/media/{id}",
    tag: "Media",
    summary: "Delete an asset",
    access: "media:delete",
    params: assetIdParamsSchema,
    responses: { 204: noContent, 409: { description: "Entries still use it." } },
  },
  {
    method: "get",
    path: "/media/{id}/file",
    tag: "Media",
    summary: "Download a file, or a resized copy of an image",
    access: "public",
    params: assetIdParamsSchema,
    query: fileTransformQuerySchema,
    responses: { 200: { description: "The file.", contentType: "application/octet-stream" } },
  },
];
