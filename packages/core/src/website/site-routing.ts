/**
 * Which content an address on the website could mean. Pure functions: the site pages
 * service tries the candidates in order and serves the first that exists.
 *
 *   /                          the home page
 *   /about                     an entry, through its collection's route pattern ("/{slug}")
 *   /about/team                a page under About, when the pattern follows the tree ("/{path}")
 *   /blog                      the list of a dated collection ("/blog/{slug}" lists at /blog)
 *   /blog/page/2               ...its second page
 *   /blog/tags/sourdough       an archive: the posts filed under one term
 *   /fr/about                  the same, in another of the site's languages
 */

/** A collection whose entries have pages, with what routing needs to know about it. */
export interface RoutedCollection {
  handle: string;
  name: string;
  structure: "tree" | "dated" | "flat";
  routePattern: string;
  /** Handles of the taxonomies its blueprint's terms fields choose from. */
  taxonomyHandles: string[];
}

export type SiteRoute =
  | { kind: "home" }
  | {
      kind: "entry";
      collection: string;
      slug: string;
      /** Found by its last part only: answer only when the whole address is the page's. */
      isGuess?: boolean;
    }
  | { kind: "list"; collection: string; page: number }
  | { kind: "archive"; collection: string; taxonomy: string; term: string; page: number };

/** The slug of the page that becomes the home page. */
export const HOME_SLUG = "home";

/**
 * Takes a language prefix off the path: "/fr/about" is "/about" in French. The site's main
 * language has no prefix. Codes match however they are written ("/FR-ca" finds "fr-CA").
 */
export function splitLocale(
  path: string,
  defaultLocale: string,
  locales: readonly string[],
): { locale: string; path: string } {
  const [, first = "", ...rest] = path.split("/");
  const locale = locales.find(
    (code) => code !== defaultLocale && code.toLowerCase() === first.toLowerCase(),
  );
  if (!locale) {
    return { locale: defaultLocale, path };
  }
  return { locale, path: `/${rest.join("/")}` };
}

/** "/fr" plus a path, for links in another language. The main language has no prefix. */
export function localisedPath(path: string, locale: string, defaultLocale: string): string {
  if (locale === defaultLocale) {
    return path;
  }
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/** The address of a list page: "/blog", "/blog/page/2". */
export function listPath(base: string, page: number): string {
  return page <= 1 ? base || "/" : `${base}/page/${page}`;
}

/** The fixed start of a route pattern, before its first placeholder: "/blog/{slug}" is "/blog". */
export function listBase(routePattern: string): string {
  const fixed = routePattern.split("{")[0] ?? "";
  return fixed.replace(/\/+$/, "");
}

/** What an address could mean, most specific first. */
export function matchSiteRoute(
  path: string,
  collections: readonly RoutedCollection[],
): SiteRoute[] {
  if (path === "/") {
    return [{ kind: "home" }];
  }
  return [...matchLists(path, collections), ...matchEntries(path, collections)];
}

function matchLists(path: string, collections: readonly RoutedCollection[]): SiteRoute[] {
  return collections.flatMap((collection): SiteRoute[] => {
    const base = listBase(collection.routePattern);
    if (collection.structure !== "dated" || base === "" || !path.startsWith(base)) {
      return [];
    }
    const rest = path.slice(base.length).split("/").filter(Boolean);
    const page = readPage(rest);
    if (page === null) {
      return [];
    }
    const remaining = rest.slice(0, page.consumed === 0 ? rest.length : -2);
    if (remaining.length === 0) {
      return [{ kind: "list", collection: collection.handle, page: page.number }];
    }
    const [taxonomy, term, ...extra] = remaining;
    if (taxonomy && term && extra.length === 0 && collection.taxonomyHandles.includes(taxonomy)) {
      return [
        { kind: "archive", collection: collection.handle, taxonomy, term, page: page.number },
      ];
    }
    return [];
  });
}

/** "page/3" at the end means the third page. Page 1 has no "page/1" address of its own. */
function readPage(segments: readonly string[]): { number: number; consumed: number } | null {
  if (segments.at(-2) !== "page") {
    return { number: 1, consumed: 0 };
  }
  const number = Number(segments.at(-1));
  return Number.isInteger(number) && number >= 2 ? { number, consumed: 2 } : null;
}

function matchEntries(path: string, collections: readonly RoutedCollection[]): SiteRoute[] {
  return [...collections]
    .sort((first, second) => fixedLength(second.routePattern) - fixedLength(first.routePattern))
    .flatMap((collection): SiteRoute[] => {
      const groups = patternToExpression(collection.routePattern).exec(path)?.groups;
      if (!groups?.slug) {
        return [];
      }
      // "/about/team" is only a guess at Team until its address is checked; "/team" (as it
      // was before pages followed the tree) may be sent on to it.
      const route: SiteRoute = { kind: "entry", collection: collection.handle, slug: groups.slug };
      return [groups.parents ? { ...route, isGuess: true } : route];
    });
}

function fixedLength(routePattern: string): number {
  return routePattern.replace(/\{[a-z]+\}/g, "").length;
}

const placeholderExpressions: Record<string, string> = {
  "{slug}": "(?<slug>[^/]+)",
  // A page's place in its tree, "about/team": its own slug is the last part.
  "{path}": "(?<parents>(?:[^/]+/)*)(?<slug>[^/]+)",
  "{year}": "\\d{4}",
  "{month}": "\\d{2}",
  "{day}": "\\d{2}",
};

function patternToExpression(routePattern: string): RegExp {
  const source = routePattern
    .split(/(\{[a-z]+\})/)
    .map((part) => placeholderExpressions[part] ?? part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("");
  return new RegExp(`^${source}$`);
}

/**
 * The tidy form of an address: decoded, without a trailing slash. Null when it can't be
 * read (a broken %-escape), which the site answers with "not found".
 */
export function tidyPath(rawPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return null;
  }
  if (!decoded.startsWith("/") || decoded.includes("\0")) {
    return null;
  }
  const collapsed = decoded.replace(/\/{2,}/g, "/");
  return collapsed.length > 1 ? collapsed.replace(/\/+$/, "") : collapsed;
}
