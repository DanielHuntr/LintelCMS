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
  updateEntryRequestSchema,
} from "../entries/entries.schema.js";
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
    access: "delivery",
    params: deliveryEntryParamsSchema,
    responses: {
      200: { description: "The entry.", schema: deliveredEntrySchema },
      404: { description: "There is no published entry with this slug." },
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
    responses: { 200: entryResponse },
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
