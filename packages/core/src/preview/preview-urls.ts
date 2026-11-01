/**
 * Fills in a collection's preview address for one entry:
 *
 *   "https://example.com/api/preview?path={url}&token={token}"
 *   becomes "https://example.com/api/preview?path=/about&token=eyJl..."
 *
 * Placeholders: {url} (the entry's address on the site), {slug}, {token}, {collection}
 * (the collection's handle), {id} (the entry's id), {site} (the site's handle) and
 * {siteUrl} (the site's address, such as https://acme.fr, so one pattern like
 * "{siteUrl}/api/preview?path={url}" serves every site). A pattern without {token} gets it
 * added as `preview=<token>`, so a site always receives one.
 *
 * Returns null when the collection has no preview address: no website is connected yet.
 */
export function buildPreviewUrl(
  pattern: string | null,
  values: {
    url: string | null;
    slug: string;
    token: string;
    collection: string;
    id: string;
    site?: string;
    siteUrl?: string;
  },
): string | null {
  if (pattern === null) {
    return null;
  }
  const replacements: Record<string, string> = {
    // encodeURI keeps the slashes of a path, which reads better in a query and works in one.
    "{url}": encodeURI(values.url ?? `/${values.slug}`),
    "{slug}": encodeURIComponent(values.slug),
    "{token}": encodeURIComponent(values.token),
    "{collection}": encodeURIComponent(values.collection),
    "{id}": encodeURIComponent(values.id),
    "{site}": encodeURIComponent(values.site ?? ""),
    // An address, not a value inside one: left as it is so its "://" and slashes survive.
    "{siteUrl}": values.siteUrl ?? "",
  };
  const filled = pattern.replace(
    /\{[a-zA-Z]+\}/g,
    (placeholder) => replacements[placeholder] ?? placeholder,
  );
  if (pattern.includes("{token}")) {
    return filled;
  }
  const separator = filled.includes("?") ? "&" : "?";
  return `${filled}${separator}preview=${encodeURIComponent(values.token)}`;
}
