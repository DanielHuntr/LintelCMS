import Link from "next/link";
import { listEntries } from "../lib/lintel";
import { HOME_PAGE_SLUG, siteName } from "../lib/site";

/** The site name, and links to the first few pages and the blog. */
export async function SiteHeader() {
  const navigation = await loadNavigation();
  return (
    <header className="site-header">
      <Link href="/" className="site-name">
        {siteName}
      </Link>
      <nav aria-label="Main">
        <ul>
          {navigation.map((item) => (
            <li key={item.href}>
              <Link href={item.href}>{item.label}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

/** Pages in the order editors set, then the blog if the site has one. */
async function loadNavigation(): Promise<{ href: string; label: string }[]> {
  try {
    const [pages, posts] = await Promise.all([
      listEntries("pages", { perPage: 6 }),
      listEntries("posts", { perPage: 1 }),
    ]);
    const pageLinks = (pages?.items ?? [])
      .filter((page) => page.slug !== HOME_PAGE_SLUG && page.url !== null)
      .slice(0, 5)
      .map((page) => ({ href: page.url ?? `/${page.slug}`, label: page.data.title }));
    return posts ? [...pageLinks, { href: "/blog", label: "Blog" }] : pageLinks;
  } catch {
    // The page itself explains when Lintel can't be reached; the header just stays short.
    return [];
  }
}
