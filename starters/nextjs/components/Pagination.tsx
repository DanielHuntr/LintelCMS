import Link from "next/link";

/** Newer and older links between pages of the blog. Page 1 is /blog; the rest /blog/page/2... */
export function Pagination({ page, pageCount }: { page: number; pageCount: number }) {
  if (pageCount <= 1) return null;
  const hrefFor = (target: number) => (target === 1 ? "/blog" : `/blog/page/${target}`);

  return (
    <nav aria-label="Blog pages" className="pagination">
      {page > 1 ? <Link href={hrefFor(page - 1)}>&larr; Newer posts</Link> : <span />}
      <span className="meta">
        Page {page} of {pageCount}
      </span>
      {page < pageCount ? <Link href={hrefFor(page + 1)}>Older posts &rarr;</Link> : <span />}
    </nav>
  );
}
