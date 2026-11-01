import type { PostListView } from "@lintel/site-components";
import { listDeliveredEntries } from "../delivery/delivery.service.js";
import { TaxonomyNotFoundError, TermNotFoundError } from "../taxonomies/taxonomies.errors.js";
import { deliverTermBySlug } from "../taxonomies/taxonomies-delivery.service.js";
import { toPostSummary } from "./delivered-to-site.js";
import { localiseUrl } from "./site-chrome.service.js";
import type { PageRequest } from "./site-pages.service.js";
import { listBase, listPath, localisedPath, type SiteRoute } from "./site-routing.js";

/** Lists of posts: a blog's index and its archives, ten posts a page, newest first. */

export const POSTS_PER_PAGE = 10;

export type ListRoute = Extract<SiteRoute, { kind: "list" | "archive" }>;

/**
 * The list for a route, or undefined when there is nothing at that address: an unknown
 * term, or a page past the last. A blog with no posts yet still has its first page.
 * `isHome` asks for the home page's version, which only exists when there are posts.
 */
export async function findListView(
  request: PageRequest,
  route: ListRoute,
  isHome: boolean,
): Promise<{ view: PostListView } | undefined> {
  const { dependencies, context, locale } = request;
  const collection = context.collections.find(({ handle }) => handle === route.collection);
  if (!collection) {
    return undefined;
  }
  const term = route.kind === "archive" ? await findTerm(request, route) : null;
  if (term === undefined) {
    return undefined;
  }
  const list = await listDeliveredEntries(
    dependencies.database,
    collection.handle,
    {
      page: route.page,
      perPage: POSTS_PER_PAGE,
      locale,
      taxonomy: route.kind === "archive" ? route.taxonomy : undefined,
      term: route.kind === "archive" ? route.term : undefined,
    },
    dependencies.assetLookup,
  );
  const totalPages = Math.max(1, Math.ceil(list.total / POSTS_PER_PAGE));
  if (route.page > totalPages || (isHome && list.total === 0)) {
    return undefined;
  }
  // On the home page, "Older posts" goes on to the blog's own second page.
  const base =
    listBase(collection.routePattern) +
    (route.kind === "archive" ? `/${route.taxonomy}/${route.term}` : "");
  const pageUrl = (page: number) =>
    localisedPath(listPath(base, page), locale, context.defaultLocale);
  return {
    view: {
      kind: "postList",
      title: term?.title ?? (isHome ? request.chrome.siteName : collection.name),
      description: term?.description ?? "",
      posts: list.items.map((entry) =>
        toPostSummary(
          entry,
          localiseUrl(entry.url ?? `/${entry.slug}`, locale, context.defaultLocale),
        ),
      ),
      pagination: {
        page: route.page,
        totalPages,
        previousUrl: route.page > 1 ? pageUrl(route.page - 1) : null,
        nextUrl: route.page < totalPages ? pageUrl(route.page + 1) : null,
      },
    },
  };
}

/** The term an archive is for, or undefined when there is no such term. */
async function findTerm(
  request: PageRequest,
  route: Extract<ListRoute, { kind: "archive" }>,
): Promise<{ title: string; description: string } | undefined> {
  try {
    const term = await deliverTermBySlug(request.dependencies.database, route.taxonomy, route.term);
    return { title: term.title, description: term.description };
  } catch (error) {
    if (error instanceof TermNotFoundError || error instanceof TaxonomyNotFoundError) {
      return undefined;
    }
    throw error;
  }
}
