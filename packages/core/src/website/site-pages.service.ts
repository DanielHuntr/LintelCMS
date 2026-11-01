import type { SiteChrome, SiteTemplate, SiteView } from "@lintel/site-components";
import type { DatabaseOrTransaction } from "../database/client.js";
import { PublishedEntryNotFoundError } from "../delivery/delivery.errors.js";
import type { DeliveredEntryWithTranslations } from "../delivery/delivery.schema.js";
import { findDeliveredEntry } from "../delivery/delivery.service.js";
import type { AssetLookup } from "../fieldtypes/image-assets.js";
import { listDeliveredRedirects } from "../seo/redirects.service.js";
import { buildRobots, buildSitemap } from "../seo/sitemap.service.js";
import type { RenderedPagesCache, SiteResponse } from "./rendered-pages-cache.js";
import { loadSiteChrome, localiseUrl } from "./site-chrome.service.js";
import { loadSiteContext, type SiteContext } from "./site-context.service.js";
import { redirectResponse, renderPage, textResponse } from "./site-documents.js";
import { buildPageHead, type HeadSubject } from "./site-head.service.js";
import { findListView, type ListRoute } from "./site-lists.service.js";
import { renderPreview } from "./site-preview.service.js";
import {
  HOME_SLUG,
  localisedPath,
  matchSiteRoute,
  type SiteRoute,
  splitLocale,
  tidyPath,
} from "./site-routing.js";
import { entryView, headForEntry } from "./site-views.js";

/**
 * The built-in website: what to answer for an address. Responses are kept in the
 * rendered pages cache, so the work below happens once per page until something changes.
 * Drafts (with a preview token) are rendered fresh every time and never kept.
 */

export interface SiteDependencies {
  database: DatabaseOrTransaction;
  assetLookup: AssetLookup;
  templates: readonly SiteTemplate[];
  builtInSiteUrl: string | null;
  cache: RenderedPagesCache;
  now?: () => Date;
}

/** What one page render can reach: the dependencies and what every page shares. */
export interface PageRequest {
  dependencies: SiteDependencies;
  context: SiteContext;
  chrome: SiteChrome;
  locale: string;
  /** The address without a language prefix, which routing reads. */
  localPath: string;
  /** The address as visited, with any language prefix. */
  path: string;
}

export function readSiteContext(dependencies: SiteDependencies): Promise<SiteContext> {
  return dependencies.cache.shareValue("context", () =>
    loadSiteContext(dependencies.database, dependencies),
  );
}

export async function readSiteChrome(
  dependencies: SiteDependencies,
  context: SiteContext,
  locale: string,
): Promise<SiteChrome> {
  return dependencies.cache.shareValue(`chrome:${locale}`, () =>
    loadSiteChrome(dependencies.database, context, locale, dependencies.assetLookup),
  );
}

/** The answer for a visit: a page, a redirect, or "not found", from the cache when it can. */
export async function respondToSitePath(
  dependencies: SiteDependencies,
  rawPath: string,
  previewToken: string | undefined,
): Promise<SiteResponse> {
  const path = tidyPath(rawPath);
  // "/about/" and "//about" are the same page as "/about": send visitors to the one address.
  if (path !== null && encodeURI(path) !== rawPath) {
    return redirectResponse(encodeURI(path), 301);
  }
  if (previewToken) {
    return renderPreview(dependencies, path ?? "/", previewToken);
  }
  const key = path ?? "unreadable";
  const cached = dependencies.cache.find(key);
  if (cached) {
    return cached;
  }
  const response = await resolveSitePath(dependencies, path);
  dependencies.cache.store(key, response);
  return response;
}

async function resolveSitePath(
  dependencies: SiteDependencies,
  path: string | null,
): Promise<SiteResponse> {
  const context = await readSiteContext(dependencies);
  if (path === "/sitemap.xml" || path === "/robots.txt") {
    return searchEngineFile(dependencies, context, path);
  }
  if (path !== null && context.seoEnabled) {
    const { redirects } = await listDeliveredRedirects(dependencies.database);
    const redirect = redirects.find((candidate) => candidate.from === path);
    if (redirect) {
      return redirectResponse(redirect.to, redirect.statusCode);
    }
  }
  const { locale, path: localPath } = splitLocale(
    path ?? "/",
    context.defaultLocale,
    context.locales.map(({ code }) => code),
  );
  if (localPath === `/${HOME_SLUG}`) {
    return redirectResponse(localisedPath("/", locale, context.defaultLocale), 301);
  }
  const chrome = await readSiteChrome(dependencies, context, locale);
  const request: PageRequest = {
    dependencies,
    context,
    chrome,
    locale,
    localPath,
    path: path ?? "/",
  };
  if (path !== null) {
    for (const route of matchSiteRoute(localPath, context.collections)) {
      const response = await respondToRoute(request, route);
      if (response) {
        return response;
      }
    }
  }
  return renderNotFound(request);
}

async function respondToRoute(
  request: PageRequest,
  route: SiteRoute,
): Promise<SiteResponse | undefined> {
  switch (route.kind) {
    case "home":
      return renderHome(request);
    case "entry": {
      const entry = await findPublished(request, route.collection, route.slug);
      if (!entry) {
        return undefined;
      }
      const canonical = localiseUrl(
        entry.url ?? request.localPath,
        request.locale,
        request.context.defaultLocale,
      );
      // A post's address holds its date; an old date in the address finds the right one.
      if (canonical !== request.path) {
        return redirectResponse(canonical, 301);
      }
      return renderEntry(request, route.collection, entry);
    }
    case "list":
    case "archive":
      return renderList(request, route);
  }
}

/** The page with the slug "home", or the newest posts, or a welcome for a new site. */
async function renderHome(request: PageRequest): Promise<SiteResponse> {
  for (const collection of request.context.collections) {
    if (collection.routePattern === "/{slug}") {
      const home = await findPublished(request, collection.handle, HOME_SLUG);
      if (home) {
        return renderEntry(request, collection.handle, home);
      }
    }
  }
  for (const collection of request.context.collections) {
    if (collection.structure === "dated") {
      const list = await renderList(
        request,
        { kind: "list", collection: collection.handle, page: 1 },
        true,
      );
      if (list) {
        return list;
      }
    }
  }
  return renderMessage(request, { kind: "emptySite" }, 200);
}

async function findPublished(
  request: PageRequest,
  collection: string,
  slug: string,
): Promise<DeliveredEntryWithTranslations | undefined> {
  try {
    return await findDeliveredEntry(
      request.dependencies.database,
      collection,
      slug,
      request.locale,
      request.dependencies.assetLookup,
    );
  } catch (error) {
    if (error instanceof PublishedEntryNotFoundError) {
      return undefined;
    }
    throw error;
  }
}

export async function renderEntry(
  request: PageRequest,
  collectionHandle: string,
  entry: DeliveredEntryWithTranslations,
  options: { private?: boolean } = {},
): Promise<SiteResponse> {
  const { context, locale } = request;
  const view = entryView(context, collectionHandle, entry, locale);
  const subject = headForEntry(context, entry, view, request.path, locale);
  const translations = new Map(
    subject.alternates.map((alternate) => [alternate.locale, alternate.path] as const),
  );
  return renderWithHead(
    request,
    view,
    { ...subject, noindex: options.private },
    {
      translations,
      private: options.private,
    },
  );
}

async function renderList(
  request: PageRequest,
  route: ListRoute,
  isHome = false,
): Promise<SiteResponse | undefined> {
  const list = await findListView(request, route, isHome);
  if (!list) {
    return undefined;
  }
  return renderWithHead(request, list.view, {
    entryId: null,
    title: list.view.title,
    description: list.view.description,
    image: null,
    path: request.path,
    type: "website",
    publishedAt: null,
    alternates: [],
  });
}

export async function renderMessage(
  request: PageRequest,
  view: SiteView,
  statusCode: number,
  title = view.kind === "message" ? view.title : request.chrome.siteName,
): Promise<SiteResponse> {
  return renderWithHead(
    request,
    view,
    {
      entryId: null,
      title,
      description: "",
      image: null,
      path: request.path,
      type: "website",
      publishedAt: null,
      alternates: [],
      noindex: statusCode !== 200,
    },
    { statusCode, private: statusCode === 401 },
  );
}

function renderNotFound(request: PageRequest): Promise<SiteResponse> {
  return renderMessage(request, { kind: "notFound" }, 404, "Page not found");
}

async function renderWithHead(
  request: PageRequest,
  view: SiteView,
  subject: HeadSubject,
  options: {
    statusCode?: number;
    private?: boolean;
    translations?: ReadonlyMap<string, string>;
  } = {},
): Promise<SiteResponse> {
  const { dependencies, context, chrome } = request;
  const head = await buildPageHead(
    dependencies.database,
    context,
    chrome.siteName,
    subject,
    dependencies.assetLookup,
  );
  const now = dependencies.now?.() ?? new Date();
  return renderPage(context, chrome, { view, head, path: request.path, ...options }, now);
}

/** sitemap.xml and robots.txt come from the SEO plugin, with the site's own addresses. */
async function searchEngineFile(
  dependencies: SiteDependencies,
  context: SiteContext,
  path: "/sitemap.xml" | "/robots.txt",
): Promise<SiteResponse> {
  if (!context.seoEnabled) {
    return textResponse("text/plain; charset=utf-8", "Not found\n", 404);
  }
  const fallbackSiteUrl = context.siteAddress;
  if (path === "/sitemap.xml" && !fallbackSiteUrl) {
    return textResponse("text/plain; charset=utf-8", "Not found\n", 404);
  }
  if (path === "/robots.txt") {
    return textResponse(
      "text/plain; charset=utf-8",
      await buildRobots(dependencies.database, { fallbackSiteUrl }),
    );
  }
  const xml = await buildSitemap(dependencies.database, {
    fallbackSiteUrl,
    pathFor: (row, entryPath) => localiseUrl(entryPath, row.locale, context.defaultLocale),
  });
  return textResponse("application/xml; charset=utf-8", xml);
}
