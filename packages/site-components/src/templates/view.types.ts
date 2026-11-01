import type { SiteBlock } from "../blocks/block.types.js";
import type { PaginationLinks, PostSummary } from "../posts/post.types.js";
import type { SiteImage, TermLink } from "../site.types.js";

/**
 * What a page of the site shows, one kind per layout. The site server picks the kind from
 * the address; a template draws each one.
 */

/** A page from a collection like Pages: a title, an optional body and its sections. */
export interface PageView {
  kind: "page";
  title: string;
  summary: string;
  heroImage: SiteImage | null;
  /** HTML from the rich text editor; empty when the page has none. */
  body: string;
  sections: SiteBlock[];
}

/** One blog post. */
export interface PostView {
  kind: "post";
  title: string;
  excerpt: string;
  publishedAt: string | null;
  image: SiteImage | null;
  body: string;
  categories: TermLink[];
  tags: TermLink[];
  /** The list the post belongs to, for "Back to the blog". */
  backLink: { label: string; url: string } | null;
}

/** A list of posts: the blog's index, or everything filed under a category or tag. */
export interface PostListView {
  kind: "postList";
  title: string;
  description: string;
  posts: PostSummary[];
  pagination: PaginationLinks;
}

/** The address doesn't match anything published. */
export interface NotFoundView {
  kind: "notFound";
}

/** Nothing has been published yet, so the home page has nothing to show. */
export interface EmptySiteView {
  kind: "emptySite";
}

export type SiteView = PageView | PostView | PostListView | NotFoundView | EmptySiteView;
