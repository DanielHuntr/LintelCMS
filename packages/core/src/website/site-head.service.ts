import type { PageHead } from "@lintel/site-components";
import type { DatabaseOrTransaction } from "../database/client.js";
import type { Site } from "../sites/sites.table.js";
import type { AssetLookup } from "../fieldtypes/image-assets.js";
import { findEntrySeo, resolveEntrySeo } from "../seo/entry-seo.service.js";
import { applyTitleTemplate } from "../seo/seo-titles.js";
import type { SiteContext } from "./site-context.service.js";

/**
 * The `<head>` of a page: its title, description, canonical address, social image and
 * robots rule. With the SEO plugin on, an entry's own SEO settings and the site defaults
 * decide them (the same answer `/delivery/:collection/:slug/seo` gives); without it, the
 * entry's title and summary are used plainly.
 */

export interface HeadSubject {
  /** The entry shown, for its SEO settings. Null for lists and messages. */
  entryId: string | null;
  title: string;
  description: string;
  image: PageHead["image"];
  /** The page's address on this site, with any language prefix. */
  path: string;
  type: PageHead["type"];
  publishedAt: string | null;
  alternates: Array<{ locale: string; path: string }>;
  noindex?: boolean;
}

export function fullAddress(context: SiteContext, path: string): string | null {
  return context.siteAddress ? `${context.siteAddress}${path}` : null;
}

export async function buildPageHead(
  database: DatabaseOrTransaction,
  context: SiteContext,
  siteName: string,
  subject: HeadSubject,
  assetLookup: AssetLookup,
  site?: Site,
): Promise<PageHead> {
  const defaults = context.seoDefaults;
  const plain: PageHead = {
    title: applyTitleTemplate(
      context.seoEnabled ? defaults.titleTemplate : "{title} | {siteName}",
      subject.title,
      siteName,
    ),
    description: subject.description,
    canonicalUrl: fullAddress(context, subject.path),
    image: subject.image,
    noindex: subject.noindex === true,
    type: subject.type,
    siteName,
    publishedAt: subject.publishedAt,
    alternates: subject.alternates.flatMap((alternate) => {
      const url = fullAddress(context, alternate.path);
      return url ? [{ locale: alternate.locale, url }] : [];
    }),
  };
  if (!context.seoEnabled) {
    return plain;
  }
  if (subject.entryId === null) {
    return {
      ...plain,
      description: plain.description || defaults.defaultDescription,
      noindex: plain.noindex || defaults.discourageSearchEngines,
    };
  }
  const [seo, own] = await Promise.all([
    resolveEntrySeo(
      database,
      { id: subject.entryId, url: subject.path, title: subject.title },
      assetLookup,
      site,
    ),
    findEntrySeo(database, subject.entryId),
  ]);
  return {
    ...plain,
    // The SEO defaults may leave the site name empty; the header's name is used then.
    title: applyTitleTemplate(
      defaults.titleTemplate,
      own.title || subject.title,
      defaults.siteName || siteName,
    ),
    description: seo.description || plain.description,
    image: seo.image ?? plain.image,
    noindex: plain.noindex || seo.noindex,
  };
}
