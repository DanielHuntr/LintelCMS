import { createHash } from "node:crypto";
import type { SiteTemplate } from "@lintel/site-components";
import { siteStylesheet } from "@lintel/site-components/server";
import { findBlueprintByIdOrFail } from "../blueprints/blueprints.service.js";
import { listCollectionsWithDetails } from "../collections/collections.repository.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import type { AssetLookup, DeliveredAsset } from "../fieldtypes/image-assets.js";
import { isSeoPluginEnabled } from "../seo/seo-enabled.js";
import type { SeoDefaults } from "../seo/seo-defaults.schema.js";
import { readSeoDefaults } from "../seo/seo-defaults.service.js";
import { isCollectionOnSite } from "../collections/collections.service.js";
import { readAddressForSite } from "../sites/site-address.service.js";
import type { Site } from "../sites/sites.table.js";
import { listLocales } from "../sites/locales.service.js";
import type { RoutedCollection } from "./site-routing.js";
import { readWebsiteLook, type WebsiteLook } from "./website.service.js";

/**
 * What every page of the built-in site needs, whatever its address: languages, which
 * collections have pages, the template and theme, and the stylesheet. Worked out once and
 * shared through the rendered pages cache until something changes.
 */
export interface SiteContext {
  defaultLocale: string;
  locales: Array<{ code: string; name: string }>;
  collections: RoutedCollection[];
  look: WebsiteLook;
  logo: DeliveredAsset | null;
  seoEnabled: boolean;
  seoDefaults: SeoDefaults;
  /** The site's public address, for canonical links and the sitemap. Null when unknown. */
  siteAddress: string | null;
  stylesheet: { css: string; path: string };
}

/** The address the stylesheet is served at changes with its contents, so it caches forever. */
export const STYLESHEET_FOLDER = "/_lintel";

export async function loadSiteContext(
  database: DatabaseOrTransaction,
  options: {
    templates: readonly SiteTemplate[];
    assetLookup: AssetLookup;
    builtInSiteUrl: string | null;
    site: Site;
  },
): Promise<SiteContext> {
  const { site } = options;
  const [locales, collections, look, seoEnabled, seoDefaults, siteAddress] = await Promise.all([
    listLocales(database, site),
    listRoutedCollections(database, site),
    readWebsiteLook(database, options.templates),
    isSeoPluginEnabled(database),
    readSeoDefaults(database),
    readAddressForSite(database, site).then((address) => address || options.builtInSiteUrl),
  ]);
  const logo = look.logoAssetId
    ? ((await options.assetLookup.findAssetsByIds([look.logoAssetId])).get(look.logoAssetId) ??
      null)
    : null;
  const css = siteStylesheet(look.theme, look.template);
  const fingerprint = createHash("sha256").update(css).digest("hex").slice(0, 12);
  return {
    defaultLocale: locales.defaultLocale,
    locales: locales.locales.map(({ code, name }) => ({ code, name })),
    collections,
    look,
    logo,
    seoEnabled,
    seoDefaults,
    siteAddress,
    stylesheet: { css, path: `${STYLESHEET_FOLDER}/site-${fingerprint}.css` },
  };
}

/** Collections whose entries have pages, with the taxonomies their posts are filed under. */
async function listRoutedCollections(
  database: DatabaseOrTransaction,
  site: Site,
): Promise<RoutedCollection[]> {
  const collections = await listCollectionsWithDetails(database, DEFAULT_TENANT_ID);
  const routed = collections.filter(
    (collection) => collection.routePattern !== null && isCollectionOnSite(collection, site),
  );
  return Promise.all(
    routed.map(async (collection) => {
      const blueprint = await findBlueprintByIdOrFail(database, collection.blueprintId);
      const taxonomyHandles = blueprint.fields.flatMap((field) =>
        field.type === "terms" && typeof field.options.taxonomy === "string"
          ? [field.options.taxonomy]
          : [],
      );
      return {
        handle: collection.handle,
        name: collection.name,
        structure: collection.structure,
        routePattern: collection.routePattern ?? "/{slug}",
        taxonomyHandles: [...new Set(taxonomyHandles)],
      };
    }),
  );
}
