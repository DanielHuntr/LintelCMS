import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { assetFileUrl } from "../media/asset-response.js";
import { isImageMimeType } from "../media/file-types.js";
import { hasPermission } from "../roles/permissions.js";
import { searchAssets, searchEntries } from "./search.repository.js";
import type { SearchQuery, SearchResults } from "./search.schema.js";
import { searchWords } from "./search-terms.js";

/** Small square thumbnails for the command palette's rows. */
const THUMBNAIL_SIZE = 96;

export interface SearchContext {
  /** What the signed-in person may do; each kind of result needs its own permission. */
  permissions: readonly string[];
  /**
   * The sites the person may work on, or null for every site. Entries from other sites
   * aren't found (LINTEL-SEC-002), as in the content tree.
   */
  siteIds: readonly string[] | null;
  /** For the URLs of image thumbnails. */
  publicApiUrl: string;
}

/**
 * One search across what the person may see: entries need `entries:read`, media needs
 * `media:read`. Kinds they can't see aren't searched at all. A query without any letters
 * or numbers finds nothing, rather than everything.
 */
export async function search(
  database: DatabaseOrTransaction,
  query: SearchQuery,
  context: SearchContext,
): Promise<SearchResults> {
  const words = searchWords(query.q);
  const canReadEntries = hasPermission(context.permissions, "entries:read");
  const canReadMedia = hasPermission(context.permissions, "media:read");
  if (words.length === 0) {
    return {
      query: query.q,
      entries: canReadEntries ? [] : null,
      assets: canReadMedia ? [] : null,
    };
  }

  const [entries, assets] = await Promise.all([
    canReadEntries
      ? searchEntries(database, DEFAULT_TENANT_ID, {
          words,
          phrase: query.q,
          limit: query.limit,
          siteIds: context.siteIds,
        })
      : null,
    canReadMedia ? searchAssets(database, DEFAULT_TENANT_ID, { words, limit: query.limit }) : null,
  ]);

  return {
    query: query.q,
    entries:
      entries?.map((entry) => ({
        id: entry.id,
        title: entry.title ?? "",
        slug: entry.slug,
        status: entry.status,
        collection: { handle: entry.collectionHandle, name: entry.collectionName },
        updatedAt: entry.updatedAt.toISOString(),
      })) ?? null,
    assets:
      assets?.map((asset) => ({
        id: asset.id,
        filename: asset.filename,
        alt: asset.alt,
        mimeType: asset.mimeType,
        thumbnailUrl: isImageMimeType(asset.mimeType)
          ? assetFileUrl(context.publicApiUrl, asset, {
              w: THUMBNAIL_SIZE,
              h: THUMBNAIL_SIZE,
              fit: "cover",
              format: "webp",
            })
          : null,
      })) ?? null,
  };
}
