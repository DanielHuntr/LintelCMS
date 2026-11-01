import type { SiteImage } from "../site.types.js";

/** A post in a list: enough for a card or a row with a link to the whole post. */
export interface PostSummary {
  id: string;
  title: string;
  url: string;
  excerpt: string;
  /** ISO 8601. Null for a post previewed before it was first published. */
  publishedAt: string | null;
  image: SiteImage | null;
}

/** Where a list of posts is, and the addresses of its neighbours. */
export interface PaginationLinks {
  page: number;
  totalPages: number;
  /** Newer posts, or null on the first page. */
  previousUrl: string | null;
  /** Older posts, or null on the last page. */
  nextUrl: string | null;
}
