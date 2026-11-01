/**
 * An entry's full address on the website, for "View page". Mirrors how the API fills in
 * route patterns (packages/core/src/delivery/entry-urls.ts) and how the built-in website
 * serves them (src/website): the page with the slug "home" is the site's root, and the
 * site's other languages are under their code ("/fr-FR/about").
 */
export function pageAddress(
  siteAddress: string,
  routePattern: string,
  entry: { slug: string; publishedAt: string | null; locale: string },
  defaultLocale: string,
): string {
  const date = new Date(entry.publishedAt ?? Date.now());
  const values: Record<string, string> = {
    "{slug}": entry.slug,
    "{year}": String(date.getUTCFullYear()),
    "{month}": String(date.getUTCMonth() + 1).padStart(2, "0"),
    "{day}": String(date.getUTCDate()).padStart(2, "0"),
  };
  const filled = routePattern.replace(
    /\{[a-z]+\}/g,
    (placeholder) => values[placeholder] ?? placeholder,
  );
  const path = filled === "/home" ? "/" : filled;
  const prefix = entry.locale === defaultLocale ? "" : `/${entry.locale}`;
  const localised = prefix && path === "/" ? prefix : `${prefix}${path}`;
  return `${siteAddress.replace(/\/+$/, "")}${localised}`;
}
