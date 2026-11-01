import type { SiteLabels } from "../site.types.js";
import type { PaginationLinks } from "./post.types.js";

export interface PaginationProps {
  links: PaginationLinks;
  labels: Pick<SiteLabels, "previousPage" | "nextPage" | "pageOfPages" | "pagination">;
}

/**
 * "Newer posts", "Page 2 of 5", "Older posts". Plain links with `rel`, so they work
 * without a script and search engines follow them. Hidden when there's only one page.
 */
export function Pagination({ links, labels }: PaginationProps) {
  if (links.totalPages <= 1) {
    return null;
  }
  return (
    <nav className="lintel-pagination" aria-label={labels.pagination}>
      {links.previousUrl ? (
        <a className="lintel-pagination__link" href={links.previousUrl} rel="prev">
          {labels.previousPage}
        </a>
      ) : (
        <span />
      )}
      <p className="lintel-pagination__status">
        {labels.pageOfPages(links.page, links.totalPages)}
      </p>
      {links.nextUrl ? (
        <a className="lintel-pagination__link" href={links.nextUrl} rel="next">
          {labels.nextPage}
        </a>
      ) : (
        <span />
      )}
    </nav>
  );
}
