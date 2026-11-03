import { createHash } from "node:crypto";
import {
  englishLabels,
  type LanguageLink,
  type PageHead,
  type SiteChrome,
  type SiteView,
} from "@lintel/site-components";
import { renderSiteDocument } from "@lintel/site-components/server";
import { siteEffectsHead } from "../site-effects/site-effects.service.js";
import type { SiteResponse } from "./rendered-pages-cache.js";
import { readEffectModules, readElementsScript, readMotionRuntime } from "./site-assets.js";
import type { SiteContext } from "./site-context.service.js";
import { localiseUrl, markCurrent } from "./site-chrome.service.js";

/** Turning a page's view, header and footer into the response that is sent and cached. */

/**
 * Pages are kept fresh in Lintel's own cache, which empties when anything changes, so
 * browsers and CDNs are asked to check back each time (cheap, thanks to the ETag).
 */
export const PAGE_CACHE_CONTROL = "public, max-age=0, must-revalidate";

export interface PageToRender {
  view: SiteView;
  head: PageHead;
  /** The address shown, for marking the current menu item. */
  path: string;
  /** Where this page is in each of the site's other languages, by locale. */
  translations?: ReadonlyMap<string, string>;
  statusCode?: number;
  /** Drafts and other private pages: never cached anywhere, never indexed. */
  private?: boolean;
}

export function renderPage(
  context: SiteContext,
  chrome: SiteChrome,
  page: PageToRender,
  now: Date,
): SiteResponse {
  const thisPageChrome = pageChrome(context, chrome, page.path, page.translations);
  const body = renderSiteDocument({
    head: page.head,
    chrome: thisPageChrome,
    view: page.view,
    template: context.look.template,
    labels: englishLabels,
    stylesheetUrl: context.stylesheet.path,
    year: now.getUTCFullYear(),
    motionScriptUrl: readMotionRuntime()?.path,
    elementsScriptUrl: readElementsScript()?.path,
    siteEffects: siteEffectsHead(context.effectSettings, {
      path: page.path,
      chrome: thisPageChrome,
    }),
    effectModuleUrls: readEffectModules()?.urls,
  });
  return htmlResponse(body, page);
}

/** The header and footer for one page: its menu item marked, its languages linked. */
export function pageChrome(
  context: SiteContext,
  chrome: SiteChrome,
  path: string,
  translations: ReadonlyMap<string, string> = new Map(),
): SiteChrome {
  return {
    ...chrome,
    menu: markCurrent(chrome.menu, path),
    languages: languageLinks(context, chrome.locale, translations),
  };
}

/** A finished page as the response that is sent and cached. */
export function htmlResponse(
  body: string,
  page: { statusCode?: number; private?: boolean },
): SiteResponse {
  return {
    statusCode: page.statusCode ?? 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": page.private ? "private, no-store" : PAGE_CACHE_CONTROL,
      etag: entityTag(body),
      ...(page.private ? { "x-robots-tag": "noindex" } : {}),
    },
    body,
  };
}

/** Every language of the site, linking to this page's translation or that language's home. */
function languageLinks(
  context: SiteContext,
  locale: string,
  translations: ReadonlyMap<string, string>,
): LanguageLink[] {
  return context.locales.map((language) => ({
    code: language.code,
    name: language.name,
    url: translations.get(language.code) ?? localiseUrl("/", language.code, context),
    current: language.code === locale,
  }));
}

export function redirectResponse(location: string, statusCode: number): SiteResponse {
  return {
    statusCode,
    headers: { location, "cache-control": PAGE_CACHE_CONTROL },
    body: "",
  };
}

export function textResponse(contentType: string, body: string, statusCode = 200): SiteResponse {
  return {
    statusCode,
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=3600",
      etag: entityTag(body),
    },
    body,
  };
}

export function entityTag(body: string): string {
  return `"${createHash("sha256").update(body).digest("base64url").slice(0, 22)}"`;
}
