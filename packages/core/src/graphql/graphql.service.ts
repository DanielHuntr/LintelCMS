import { GraphQLError } from "graphql";
import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { lookUpReferences } from "../delivery/delivered-references.js";
import { collectImageIds, deliverValues } from "../delivery/delivered-values.js";
import { PublishedEntryNotFoundError } from "../delivery/delivery.errors.js";
import { findDeliveredEntry, listDeliveredEntries } from "../delivery/delivery.service.js";
import { buildEntryUrl } from "../delivery/entry-urls.js";
import type { AssetLookup, DeliveredAsset } from "../fieldtypes/image-assets.js";
import { HttpError } from "../http/http-errors.js";
import { assetFileUrl } from "../media/asset-response.js";
import { listAssetRows } from "../media/media.repository.js";
import type { AssetKind } from "../media/media.schema.js";
import { isSeoPluginEnabled } from "../seo/seo-plugin.js";
import { entrySiteFor } from "../collections/collections.service.js";
import { resolveLocale } from "../sites/locales.service.js";
import { addPathPrefix } from "../sites/site-addresses.js";
import type { Site } from "../sites/sites.table.js";
import {
  type CollectionWithBlueprint,
  findWorkingCopyBySlug,
  listCollectionsWithBlueprints,
  listWorkingCopies,
  type WorkingCopyRow,
} from "./graphql.repository.js";

/** What every resolver can use, made fresh for each request (see graphql.routes.ts). */
export interface GraphqlContext {
  database: DatabaseOrTransaction;
  assetLookup: AssetLookup;
  publicApiUrl: string;
  /** Drafts may be read with `preview: true`: a read-write token or an admin session. */
  canPreview: boolean;
  /**
   * The entry a live-preview link was made for (a signed preview token, see src/preview).
   * Its draft, and only its draft, may be read with `preview: true` without other access.
   */
  previewEntryId?: string;
  /** The whole media library may be listed: any API token or an admin session. */
  canListMedia: boolean;
  /** The site the request is for (`?site=`, the `Lintel-Site` header or the domain). */
  site?: Site;
}

/** The collections and blueprints the schema is built from. */
export interface ContentModel {
  collections: CollectionWithBlueprint[];
  seoEnabled: boolean;
  /** Changes whenever a collection or blueprint does, so a built schema can be reused until then. */
  version: string;
}

/** One entry as GraphQL resolves it. `data` is already expanded, as the delivery API does it. */
export interface GraphqlEntry {
  id: string;
  slug: string;
  url: string | null;
  status: string;
  publishedAt: string | null;
  title: string;
  data: Record<string, unknown>;
}

export interface PageArguments {
  page: number;
  perPage: number;
  preview: boolean;
  /** A language code such as "fr"; the site's main language when left out. */
  locale?: string | null;
}

export const MAX_PER_PAGE = 100;

export async function loadContentModel(database: DatabaseOrTransaction): Promise<ContentModel> {
  const collections = await listCollectionsWithBlueprints(database, DEFAULT_TENANT_ID);
  const seoEnabled = await isSeoPluginEnabled(database);
  const version = JSON.stringify([
    seoEnabled,
    collections.map((collection) => [
      collection.id,
      collection.handle,
      collection.updatedAt.getTime(),
      collection.blueprint.handle,
      collection.blueprint.version,
      collection.blueprint.updatedAt.getTime(),
    ]),
  ]);
  return { collections, seoEnabled, version };
}

export async function listCollectionEntries(
  context: GraphqlContext,
  collection: CollectionWithBlueprint,
  args: PageArguments,
): Promise<{ items: GraphqlEntry[]; total: number }> {
  checkPageArguments(args);
  if (args.preview) {
    requirePreview(context);
    const entrySite = await entrySiteFor(context.database, collection, context.site);
    const { locale } = await resolveLocale(context.database, args.locale ?? undefined, entrySite);
    const { rows, total } = await listWorkingCopies(
      context.database,
      collection.id,
      entrySite.id,
      locale,
      collection.structure === "dated",
      { limit: args.perPage, offset: (args.page - 1) * args.perPage },
    );
    return { items: await expandWorkingCopies(context, collection, rows), total };
  }

  const list = await listDeliveredEntries(
    context.database,
    collection.handle,
    { page: args.page, perPage: args.perPage, locale: args.locale ?? undefined },
    context.assetLookup,
    context.site,
  );
  return {
    items: list.items.map((item) => ({ ...item, status: "published", title: titleOf(item.data) })),
    total: list.total,
  };
}

/** One entry by slug, or null: a draft is only found with `preview: true`. */
export async function findCollectionEntry(
  context: GraphqlContext,
  collection: CollectionWithBlueprint,
  slug: string,
  preview: boolean,
  requestedLocale?: string | null,
): Promise<GraphqlEntry | null> {
  if (preview) {
    const entrySite = await entrySiteFor(context.database, collection, context.site);
    const { locale } = await resolveLocale(
      context.database,
      requestedLocale ?? undefined,
      entrySite,
    );
    const row = await findWorkingCopyBySlug(
      context.database,
      collection.id,
      entrySite.id,
      locale,
      slug,
    );
    // A preview link opens exactly one draft; anything wider needs a token or a session.
    if (!(row && row.id === context.previewEntryId)) {
      requirePreview(context);
    }
    const [entry] = row ? await expandWorkingCopies(context, collection, [row]) : [];
    return entry ?? null;
  }
  try {
    const entry = await findDeliveredEntry(
      context.database,
      collection.handle,
      slug,
      requestedLocale ?? undefined,
      context.assetLookup,
      undefined,
      context.site,
    );
    return { ...entry, status: "published", title: titleOf(entry.data) };
  } catch (error) {
    if (error instanceof PublishedEntryNotFoundError) {
      return null;
    }
    throw error;
  }
}

export async function findAsset(
  context: GraphqlContext,
  assetId: string,
): Promise<DeliveredAsset | null> {
  const assets = await context.assetLookup.findAssetsByIds([assetId]);
  return assets.get(assetId) ?? null;
}

/**
 * The media library, newest first. Only for requests with a token or a session, since a
 * library can hold files nobody has published yet; a single asset by id is public, like
 * its file.
 */
export async function listMedia(
  context: GraphqlContext,
  args: { page: number; perPage: number; type: AssetKind | null },
): Promise<{ items: DeliveredAsset[]; total: number }> {
  if (!context.canListMedia) {
    throw new GraphQLError("Listing the media library needs an API token.", {
      extensions: { code: "API_TOKEN_REQUIRED" },
    });
  }
  checkPageArguments({ ...args, preview: false });
  const { rows, total } = await listAssetRows(context.database, DEFAULT_TENANT_ID, {
    kind: args.type ?? undefined,
    limit: args.perPage,
    offset: (args.page - 1) * args.perPage,
  });
  return {
    items: rows.map((row) => ({
      id: row.id,
      url: assetFileUrl(context.publicApiUrl, row),
      alt: row.alt,
      width: row.width,
      height: row.height,
      focalPoint: { x: row.focalX, y: row.focalY },
    })),
    total,
  };
}

async function expandWorkingCopies(
  context: GraphqlContext,
  collection: CollectionWithBlueprint,
  rows: readonly WorkingCopyRow[],
): Promise<GraphqlEntry[]> {
  const fields = collection.blueprint.fields;
  const imageIds = collectImageIds(
    fields,
    rows.map((row) => row.data),
  );
  const assets =
    imageIds.length > 0 ? await context.assetLookup.findAssetsByIds(imageIds) : new Map();
  const references = await lookUpReferences(
    context.database,
    fields,
    rows.map((row) => row.data),
    rows[0]?.locale ?? "",
  );
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    url: addPathPrefix(context.site?.pathPrefix ?? "", buildEntryUrl(collection.routePattern, row)),
    status: row.status,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    title: titleOf(row.data),
    data: deliverValues(fields, row.data, assets, references),
  }));
}

function requirePreview(context: GraphqlContext): void {
  if (!context.canPreview) {
    throw new GraphQLError(
      "Previewing drafts needs a preview link for that entry, a read-write API token, or being signed in to the admin.",
      { extensions: { code: "PREVIEW_NOT_ALLOWED" } },
    );
  }
}

function checkPageArguments(args: PageArguments): void {
  if (args.page < 1 || args.perPage < 1 || args.perPage > MAX_PER_PAGE) {
    throw new GraphQLError(`page should be 1 or more, and perPage from 1 to ${MAX_PER_PAGE}.`, {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
}

function titleOf(data: Record<string, unknown>): string {
  return typeof data.title === "string" ? data.title : "";
}

/** HTTP errors from the services become GraphQL errors with the same code and message. */
export function toGraphqlError(error: unknown): unknown {
  if (error instanceof HttpError) {
    return new GraphQLError(error.message, { extensions: { code: error.code } });
  }
  return error;
}
