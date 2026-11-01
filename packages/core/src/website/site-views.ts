import type { PageView, PostView } from "@lintel/site-components";
import type { DeliveredEntryWithTranslations } from "../delivery/delivery.schema.js";
import { toPageView, toPostView } from "./delivered-to-site.js";
import { localiseUrl } from "./site-chrome.service.js";
import type { SiteContext } from "./site-context.service.js";
import type { HeadSubject } from "./site-head.service.js";
import { listBase, localisedPath } from "./site-routing.js";

/** Which layout an entry gets, and what its `<head>` says. Pure, given the site context. */

/** Posts (entries of dated collections) get the post layout; everything else is a page. */
export function entryView(
  context: SiteContext,
  collectionHandle: string,
  entry: DeliveredEntryWithTranslations,
  locale: string,
): PageView | PostView {
  const collection = context.collections.find(({ handle }) => handle === collectionHandle);
  if (collection?.structure !== "dated") {
    return toPageView(entry);
  }
  const base = listBase(collection.routePattern);
  const localise = (path: string) => localisedPath(path, locale, context.defaultLocale);
  return toPostView(entry, {
    termUrl: (taxonomy, slug) =>
      base !== "" && collection.taxonomyHandles.includes(taxonomy)
        ? localise(`${base}/${taxonomy}/${encodeURIComponent(slug)}`)
        : null,
    backLink: base !== "" ? { label: collection.name, url: localise(base) } : null,
  });
}

export function headForEntry(
  context: SiteContext,
  entry: DeliveredEntryWithTranslations,
  view: PageView | PostView,
  path: string,
  locale: string,
): HeadSubject {
  const image = view.kind === "page" ? view.heroImage : view.image;
  const alternates = entry.translations.flatMap((translation) =>
    translation.url === null
      ? []
      : [
          {
            locale: translation.locale,
            path: localiseUrl(translation.url, translation.locale, context.defaultLocale),
          },
        ],
  );
  return {
    entryId: entry.id,
    title: view.title,
    description: view.kind === "page" ? view.summary : view.excerpt,
    image: image
      ? { url: image.url, alt: image.alt, width: image.width, height: image.height }
      : null,
    path,
    type: view.kind === "post" ? "article" : "website",
    publishedAt: entry.publishedAt,
    alternates: alternates.length > 0 ? [{ locale, path }, ...alternates] : [],
  };
}
