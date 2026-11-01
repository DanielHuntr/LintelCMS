import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { findDeliveredEntry } from "../delivery/delivery.service.js";
import { findEntryOrFail } from "../entries/entries.service.js";
import type { AssetExists, AssetLookup } from "../fieldtypes/image-assets.js";
import { InvalidFieldsError } from "../http/http-errors.js";
import { readSeoDefaults } from "./seo-defaults.service.js";
import { applyTitleTemplate } from "./seo-titles.js";
import { findEntrySeoRow, upsertEntrySeoRow } from "./seo.repository.js";
import type { DeliveredEntrySeo, EntrySeo, EntrySeoRequest } from "./seo.schema.js";

/** An entry's own SEO settings, and the finished version websites put in a page's <head>. */

const emptySeo: EntrySeo = { title: "", description: "", socialImageId: null, noindex: false };

export async function findEntrySeo(
  database: DatabaseOrTransaction,
  entryId: string,
): Promise<EntrySeo> {
  await findEntryOrFail(database, entryId);
  const row = await findEntrySeoRow(database, DEFAULT_TENANT_ID, entryId);
  return row
    ? {
        title: row.title,
        description: row.description,
        socialImageId: row.socialImageId,
        noindex: row.noindex,
      }
    : emptySeo;
}

export async function saveEntrySeo(
  database: DatabaseOrTransaction,
  entryId: string,
  request: EntrySeoRequest,
  assetExists: AssetExists,
): Promise<EntrySeo> {
  await findEntryOrFail(database, entryId);
  if (request.socialImageId !== null && !(await assetExists(request.socialImageId))) {
    throw new InvalidFieldsError({
      socialImageId: "That image isn't in the media library any more. Please choose another.",
    });
  }
  await upsertEntrySeoRow(database, DEFAULT_TENANT_ID, entryId, request);
  return findEntrySeo(database, entryId);
}

/**
 * A published entry's SEO, with the site defaults filled in: the title through the
 * template, the default description and image when the entry has none, and the full
 * address when the site's address is known. Drafts get the same 404 as delivery does.
 */
export async function deliverEntrySeo(
  database: DatabaseOrTransaction,
  collectionHandle: string,
  slug: string,
  assetLookup: AssetLookup,
): Promise<DeliveredEntrySeo> {
  const entry = await findDeliveredEntry(database, collectionHandle, slug, assetLookup);
  const title = typeof entry.data.title === "string" ? entry.data.title : "";
  return resolveEntrySeo(database, { id: entry.id, url: entry.url, title }, assetLookup);
}

/** The finished SEO for an entry the caller has already found (delivery and GraphQL). */
export async function resolveEntrySeo(
  database: DatabaseOrTransaction,
  entry: { id: string; url: string | null; title: string },
  assetLookup: AssetLookup,
): Promise<DeliveredEntrySeo> {
  const own = await findEntrySeo(database, entry.id);
  const defaults = await readSeoDefaults(database);

  const imageId = own.socialImageId ?? defaults.defaultSocialImageId;
  const image = imageId ? (await assetLookup.findAssetsByIds([imageId])).get(imageId) : undefined;

  return {
    title: applyTitleTemplate(defaults.titleTemplate, own.title || entry.title, defaults.siteName),
    description: own.description || defaults.defaultDescription,
    canonicalUrl: defaults.siteUrl && entry.url ? `${defaults.siteUrl}${entry.url}` : null,
    image: image
      ? { url: image.url, alt: image.alt, width: image.width, height: image.height }
      : null,
    noindex: own.noindex || defaults.discourageSearchEngines,
  };
}
