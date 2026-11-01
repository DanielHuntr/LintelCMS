/** What goes in a page's `<head>`: its title and what search engines and social sites read. */
export interface PageHead {
  /** The finished title, such as "About us | Corner Bakery". */
  title: string;
  description: string;
  /** The page's one true full address, or null when the site's address isn't known. */
  canonicalUrl: string | null;
  image: { url: string; alt: string; width: number | null; height: number | null } | null;
  /** Ask search engines not to list the page. */
  noindex: boolean;
  /** "article" for blog posts, "website" for everything else (Open Graph). */
  type: "website" | "article";
  siteName: string;
  /** ISO 8601, for posts. */
  publishedAt: string | null;
  /** The same page in the site's other languages, for `hreflang` links. */
  alternates: Array<{ locale: string; url: string }>;
}
