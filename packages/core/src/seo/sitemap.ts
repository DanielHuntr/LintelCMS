/**
 * The text of sitemap.xml and robots.txt. Pure functions, so the rules are easy to test;
 * sitemap.service.ts gathers what goes in them.
 */

export interface SitemapPage {
  /** The full address, like https://www.example.com/blog/hello. */
  location: string;
  lastModified: Date;
}

/** The most addresses one sitemap file may list, by the sitemaps.org rules. */
export const MAX_SITEMAP_PAGES = 50_000;

export function buildSitemapXml(pages: readonly SitemapPage[]): string {
  const urls = pages.map(
    (page) =>
      `  <url>\n    <loc>${escapeXml(page.location)}</loc>\n    <lastmod>${page.lastModified.toISOString()}</lastmod>\n  </url>`,
  );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
}

/**
 * Lets every search engine in and points them at the sitemap, or, while the site is
 * "discouraging search engines", asks them all to stay out.
 */
export function buildRobotsTxt(options: {
  discourageSearchEngines: boolean;
  sitemapUrl: string | null;
}): string {
  const lines = ["User-agent: *", options.discourageSearchEngines ? "Disallow: /" : "Allow: /"];
  if (options.sitemapUrl && !options.discourageSearchEngines) {
    lines.push("", `Sitemap: ${options.sitemapUrl}`);
  }
  return `${lines.join("\n")}\n`;
}

function escapeXml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
