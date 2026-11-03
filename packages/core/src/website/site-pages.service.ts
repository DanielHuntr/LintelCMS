import type { SiteChrome, SiteTemplate, SiteView } from "@lintel/site-components";
import { listSiteStarts, type SiteStartSummary } from "../content-roots/content-roots.service.js";
import { listSiteStartHostnames } from "../content-roots/content-roots.service.js";
import { matchRootForPath, pathOfAddress } from "../content-roots/root-addresses.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { PublishedEntryNotFoundError } from "../delivery/delivery.errors.js";
import type { DeliveredEntryWithTranslations } from "../delivery/delivery.schema.js";
import { findDeliveredEntry } from "../delivery/delivery.service.js";
import type { AssetLookup } from "../fieldtypes/image-assets.js";
import { listDeliveredRedirects } from "../seo/redirects.service.js";
import { buildRobots, buildSitemap } from "../seo/sitemap.service.js";
import {
  addPathPrefix,
  hostnameMatches,
  normalizeHostname,
  removePathPrefix,
} from "../sites/site-addresses.js";
import type { Site } from "../sites/sites.table.js";
import type { LiquidTemplates } from "../liquid-templates/liquid-templates.service.js";
import { renderEntryWithLiquid } from "../liquid-templates/liquid-pages.service.js";
import type { PageCache, SiteResponse } from "./rendered-pages-cache.js";
import { loadSiteChrome, localiseUrl } from "./site-chrome.service.js";
import { loadSiteContext, type SiteContext } from "./site-context.service.js";
import { redirectResponse, renderPage, textResponse } from "./site-documents.js";
import { buildPageHead, type HeadSubject } from "./site-head.service.js";
import { findListView, type ListRoute } from "./site-lists.service.js";
import { renderPreview } from "./site-preview.service.js";
import {
  HOME_SLUG,
  matchSiteRoute,
  type SiteRoute,
  splitLocale,
  tidyPath,
} from "./site-routing.js";
import { designEntryView } from "./entry-designs.service.js";
import { respondToShopPath } from "./shop-pages.service.js";
import { renderSearch } from "./site-search.service.js";
import type { SiteSources } from "./site-sources.js";
import { entryView, headForEntry } from "./site-views.js";
import { withSiteSections } from "./site-sections-drawing.js";
import { type ExperimentVisit, withTestsScript } from "../experiments/experiment-pages.js";

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
  /** The site this visit is to, found from the address (see site.routes.ts). */
  site: Site;
  /** The domain the visit came to, for site starts with a domain of their own. */
  host?: string;
  /** The rendered pages cache, for this site's pages. */
  cache: PageCache;
  now?: () => Date;
  /** The shop's products and the forms, for the elements that show them. None when left out. */
  sources?: SiteSources;
  /** The templates folder's Liquid templates (see src/liquid-templates). None when left out. */
  liquidTemplates?: LiquidTemplates | null;
  /** The running A/B tests and the versions this visitor sees (see src/experiments). */
  experiments?: ExperimentVisit;
}

/** What the address's query asks of the page's lists: `?page=2&sort=priceLowToHigh`. */
export interface PageQuery {
  page: number;
  sort?: string;
  /** What was typed in a Search box, for `/search`. */
  search?: string;
}

/** What one page render can reach: the dependencies and what every page shares. */
export interface PageRequest {
  dependencies: SiteDependencies;
  context: SiteContext;
  chrome: SiteChrome;
  locale: string;
  /** The address without a language prefix, which routing reads. */
  localPath: string;
  /** The address as visited, with any site and language prefix. */
  path: string;
  query: PageQuery;
  /** On a shop collection's page, the collection its product grids show. */
  shopCollection?: string;
  /** The pages at the top of the page trees, in this language, and where each answers. */
  siteStarts: SiteStartSummary[];
  /** The site start this address is under, for the domain visited. */
  siteStart?: SiteStartSummary;
}

export function readSiteContext(dependencies: SiteDependencies): Promise<SiteContext> {
  return dependencies.cache.shareValue("context", () =>
    loadSiteContext(dependencies.database, dependencies),
  );
}

/** The site starts in a language, shared until something changes. */
export function readSiteStarts(
  dependencies: SiteDependencies,
  locale: string,
): Promise<SiteStartSummary[]> {
  return dependencies.cache.shareValue(`site-starts:${locale}`, () =>
    listSiteStarts(dependencies.database, dependencies.site.id, locale),
  );
}

/**
 * The visited domain when a site start has it as its own, else "": pages differ per domain
 * only then, so the cache keeps one copy of a page for every other domain of the site.
 */
async function siteStartHost(dependencies: SiteDependencies): Promise<string> {
  const host = dependencies.host;
  if (!host) {
    return "";
  }
  const hostnames = await dependencies.cache.shareValue("site-start-hostnames", () =>
    listSiteStartHostnames(dependencies.database, dependencies.site.id),
  );
  const requestHost = normalizeHostname(host);
  return requestHost !== null && hostnames.some((name) => hostnameMatches(name, requestHost))
    ? requestHost
    : "";
}

export async function readSiteChrome(
  dependencies: SiteDependencies,
  context: SiteContext,
  locale: string,
): Promise<SiteChrome> {
  return dependencies.cache.shareValue(`chrome:${locale}`, () =>
    loadSiteChrome(
      dependencies.database,
      context,
      locale,
      dependencies.assetLookup,
      dependencies.site,
    ),
  );
}

/** The answer for a visit: a page, a redirect, or "not found", from the cache when it can. */
export async function respondToSitePath(
  dependencies: SiteDependencies,
  rawPath: string,
  previewToken: string | undefined,
  query: PageQuery = { page: 1 },
): Promise<SiteResponse> {
  const path = tidyPath(rawPath);
  // "/about/" and "//about" are the same page as "/about": send visitors to the one address.
  if (path !== null && encodeURI(path) !== rawPath) {
    return redirectResponse(onSite(dependencies, encodeURI(path)), 301);
  }
  if (previewToken) {
    return renderPreview(dependencies, path ?? "/", previewToken);
  }
  const host = await siteStartHost(dependencies);
  // Each version of a tested page is kept apart (see src/experiments).
  const experiments = dependencies.experiments;
  const key = `${host}${path ?? "unreadable"}${queryKey(query)}${experiments?.cacheKey ?? ""}`;
  const cached = dependencies.cache.find(key);
  if (cached) {
    return cached;
  }
  const response = withTestsScript(
    await resolveSitePath(dependencies, path, query, host),
    experiments,
  );
  dependencies.cache.store(key, response);
  return response;
}

/**
 * An address on this site as visitors see it: with the site's path prefix ("/fr/about" for
 * "/about" on a site served under /fr). Entry addresses from delivery already have it.
 */
function onSite(dependencies: SiteDependencies, path: string): string {
  return addPathPrefix(dependencies.site.pathPrefix, path) ?? path;
}

function queryKey(query: PageQuery): string {
  const parts = [
    query.page > 1 ? `page=${query.page}` : "",
    query.sort ? `sort=${query.sort}` : "",
    query.search ? `q=${encodeURIComponent(query.search)}` : "",
  ];
  const search = parts.filter(Boolean).join("&");
  return search ? `?${search}` : "";
}

async function resolveSitePath(
  dependencies: SiteDependencies,
  path: string | null,
  query: PageQuery,
  host: string,
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
  const chrome = await readSiteChrome(dependencies, context, locale);
  const siteStarts = await readSiteStarts(dependencies, locale);
  const siteStart = matchRootForPath(siteStarts, localPath, host || undefined);
  const request: PageRequest = {
    dependencies,
    context,
    chrome,
    locale,
    localPath,
    path: siteStart?.hostname ? (path ?? "/") : onSite(dependencies, path ?? "/"),
    query,
    siteStarts,
    siteStart,
  };
  if (path !== null) {
    const underStart = await respondUnderSiteStart(request);
    if (underStart) {
      return underStart;
    }
    for (const route of matchSiteRoute(localPath, context.collections)) {
      const response = await respondToRoute(request, route);
      if (response) {
        return response;
      }
    }
    if (localPath === "/search") {
      return renderSearch(request);
    }
    const shopPage = await respondToShopPath(request);
    if (shopPage) {
      return shopPage;
    }
  }
  return renderNotFound(request);
}

/**
 * A site start answering under a path of its own ("/shop") or on a domain of its own is
 * that page, and the pages under it are below it ("/shop/about"). Undefined for an address
 * no such site start covers.
 */
async function respondUnderSiteStart(request: PageRequest): Promise<SiteResponse | undefined> {
  const start = request.siteStart;
  if (!start || (start.hostname === "" && start.pathPrefix === "")) {
    return undefined;
  }
  const rest = removePathPrefix(start.pathPrefix, request.localPath);
  if (rest === "/") {
    const entry = await findPublished(request, start.collection.handle, start.slug);
    return entry ? renderEntry(request, start.collection.handle, entry) : undefined;
  }
  for (const route of matchSiteRoute(rest, request.context.collections)) {
    if (route.kind !== "entry") {
      continue;
    }
    const response = await respondToRoute(request, route);
    if (response) {
      return response;
    }
  }
  return undefined;
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
      // On a site start's own domain the site's prefix doesn't apply (see site-for-address.ts).
      const isOnOwnDomain = entry.url !== null && !entry.url.startsWith("/");
      const canonical = localiseUrl(
        pathOfAddress(entry.url ?? request.localPath),
        request.locale,
        isOnOwnDomain ? { ...request.context, pathPrefix: "" } : request.context,
      );
      // Found by its slug alone, the page answers only at its own address.
      if (route.isGuess && canonical !== request.path) {
        return undefined;
      }
      // On a site start's own domain only the pages under it answer, and a page under one
      // sends visitors from elsewhere to its domain.
      const domain = domainCheck(request, entry.url);
      if (domain === "elsewhere") {
        return undefined;
      }
      if (domain === "own-domain" && entry.url) {
        return redirectResponse(entry.url, 301);
      }
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

/**
 * Whether a page's address belongs on the domain visited. A full address (under a site start
 * with a domain of its own) belongs on that domain only, a path on the site's others.
 * "own-domain" is a page that lives on another domain, "elsewhere" one that isn't on this one.
 */
function domainCheck(
  request: PageRequest,
  url: string | null,
): "here" | "own-domain" | "elsewhere" {
  const visitedHostname = request.siteStart?.hostname ?? "";
  const isFull = url !== null && !url.startsWith("/");
  if (visitedHostname === "") {
    return isFull ? "own-domain" : "here";
  }
  return isFull && url.startsWith(`https://${visitedHostname}/`) ? "here" : "elsewhere";
}

/**
 * The site start that answers at "/", or (for sites from before site starts) the page with
 * the slug "home", or the newest posts, or a welcome for a new site.
 */
async function renderHome(request: PageRequest): Promise<SiteResponse> {
  const start = request.siteStart;
  const startEntry = start && (await findPublished(request, start.collection.handle, start.slug));
  if (start && startEntry) {
    return renderEntry(request, start.collection.handle, startEntry);
  }
  for (const collection of request.context.collections) {
    if (collection.routePattern === "/{slug}" || collection.routePattern === "/{path}") {
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
      undefined,
      request.dependencies.site,
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
  /** `draft`: the entry is its working copy, shown with a preview token. */
  options: { private?: boolean; draft?: boolean } = {},
): Promise<SiteResponse> {
  const { context, locale } = request;
  const listed = entryView(context, collectionHandle, entry, locale);
  const subject = headForEntry(context, entry, listed, request.path, locale);
  const view = await designEntryView(request, collectionHandle, entry, listed);
  const translations = new Map(
    subject.alternates.map((alternate) => [alternate.locale, alternate.path] as const),
  );
  const templates = request.dependencies.liquidTemplates;
  const templateName = await templates?.findTemplateForEntry(
    request.dependencies.database,
    { id: entry.id, collectionHandle },
    options.draft ? "draft" : "published",
  );
  if (templates && templateName) {
    return renderEntryWithLiquid(request, {
      templates,
      templateName,
      collectionHandle,
      entry,
      view,
      subject: { ...subject, noindex: options.private },
      translations,
      private: options.private,
    });
  }
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

export async function renderWithHead(
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
    dependencies.site,
  );
  const now = dependencies.now?.() ?? new Date();
  const withSections = await withSiteSections(request, chrome);
  return renderPage(context, withSections, { view, head, path: request.path, ...options }, now);
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
      await buildRobots(dependencies.database, { site: dependencies.site, fallbackSiteUrl }),
    );
  }
  const xml = await buildSitemap(dependencies.database, {
    site: dependencies.site,
    fallbackSiteUrl,
    pathFor: (row, entryPath) => localiseUrl(entryPath, row.locale, context),
  });
  return textResponse("application/xml; charset=utf-8", xml);
}
