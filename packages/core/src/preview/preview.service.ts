import { findCollectionByIdOrFail } from "../collections/collections.service.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { findDeliveredDraft } from "../delivery/delivery.service.js";
import { buildEntryUrl } from "../delivery/entry-urls.js";
import { findEntryOrFail } from "../entries/entries.service.js";
import type { AssetLookup } from "../fieldtypes/image-assets.js";
import { readOrCreateSetting } from "../settings/settings.service.js";
import { addPathPrefix } from "../sites/site-addresses.js";
import { findSiteByIdOrFail } from "../sites/sites.service.js";
import type { Site } from "../sites/sites.table.js";
import { PreviewTokenExpiredError, PreviewTokenInvalidError } from "./preview.errors.js";
import type { EntryPreview, PreviewedEntry } from "./preview.schema.js";
import {
  checkPreviewToken,
  generatePreviewSecret,
  PREVIEW_TOKEN_LIFETIME_MS,
  signPreviewToken,
} from "./preview-tokens.js";
import { buildPreviewUrl } from "./preview-urls.js";

/**
 * Live preview: signed, short-lived tokens that let a website (or the admin's built-in
 * preview) see one entry's unsaved-to-the-site draft. There is no repository here: tokens
 * aren't stored, and the signing secret lives in settings.
 */

function findSigningSecret(database: DatabaseOrTransaction): Promise<string> {
  return readOrCreateSetting(database, "previewSigningSecret", generatePreviewSecret);
}

/**
 * A new token for the entry, and where its website shows it (null when none is connected).
 * The address is the entry's site's: its path prefix and, for `{siteUrl}`, its address. An
 * entry of a shared collection is previewed on `site`, the one the editor is working on.
 * A collection without a preview address of its own, whose entries have pages, is shown on
 * the built-in website when there is one (`builtInSiteUrl`, see src/website): at the site's
 * own address if it has one, else at the built-in website's.
 */
export async function createEntryPreview(
  database: DatabaseOrTransaction,
  entryId: string,
  now: Date = new Date(),
  builtInSiteUrl: string | null = null,
  site?: Site,
): Promise<EntryPreview> {
  const entry = await findEntryOrFail(database, entryId);
  const collection = await findCollectionByIdOrFail(database, entry.collectionId);
  const previewSite =
    collection.siteScope === "shared" && site !== undefined
      ? site
      : await findSiteByIdOrFail(database, entry.siteId);
  const expiresAt = now.getTime() + PREVIEW_TOKEN_LIFETIME_MS;
  const token = signPreviewToken(
    { entryId: entry.id, expiresAt },
    await findSigningSecret(database),
  );

  return {
    token,
    expiresAt: new Date(expiresAt).toISOString(),
    previewUrl: buildPreviewUrl(builtInPreviewPattern(collection, previewSite, builtInSiteUrl), {
      url: addPathPrefix(
        previewSite.pathPrefix,
        buildEntryUrl(collection.routePattern, {
          slug: entry.slug,
          publishedAt: entry.publishedAt ?? now,
        }),
      ),
      slug: entry.slug,
      token,
      collection: collection.handle,
      id: entry.id,
      site: previewSite.handle,
      siteUrl: previewSite.siteUrl,
    }),
  };
}

/** The collection's own preview address, or the built-in website's for entries with pages. */
function builtInPreviewPattern(
  collection: { previewUrlPattern: string | null; routePattern: string | null },
  site: Site,
  builtInSiteUrl: string | null,
): string | null {
  if (collection.previewUrlPattern) return collection.previewUrlPattern;
  const address = site.siteUrl || builtInSiteUrl;
  return address && collection.routePattern ? `${address.replace(/\/+$/, "")}{url}` : null;
}

/** The id of the entry a token is for, or a 401 that says whether it expired. */
export async function readPreviewToken(
  database: DatabaseOrTransaction,
  token: string,
  now: Date = new Date(),
): Promise<string> {
  const checked = checkPreviewToken(token, await findSigningSecret(database), now);
  if (checked.status === "expired") {
    throw new PreviewTokenExpiredError();
  }
  if (checked.status === "invalid") {
    throw new PreviewTokenInvalidError();
  }
  return checked.payload.entryId;
}

/** The draft a token is for. An entry deleted since the token was made is an invalid token. */
export async function findPreviewedEntry(
  database: DatabaseOrTransaction,
  token: string,
  assetLookup: AssetLookup,
): Promise<PreviewedEntry> {
  const entryId = await readPreviewToken(database, token);
  const draft = await findDeliveredDraft(database, entryId, assetLookup);
  if (!draft) {
    throw new PreviewTokenInvalidError();
  }
  return { collection: draft.collectionHandle, site: draft.siteHandle, entry: draft.entry };
}
