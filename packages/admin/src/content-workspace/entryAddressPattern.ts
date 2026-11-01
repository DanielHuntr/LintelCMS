/**
 * What the workspace header's "URL:" shows, from where the page really is (the Info tab's
 * address) rather than its collection's pattern alone: "/shop/{slug}" for a page under a
 * second page at the top, "https://shop.example.com/{slug}" under one with its own domain.
 *
 * `fixedAddress` is set when the slug isn't part of the address at all: the home page ("/")
 * and a top page with its own domain or path.
 */
export function entryAddressPattern(
  routePattern: string,
  savedSlug: string,
  info: { url: string | null; siteStart: object | null } | undefined,
): { pattern: string; fixedAddress?: string } {
  const url = info?.url;
  if (!url || savedSlug === "") {
    return { pattern: routePattern };
  }
  if (url.endsWith(`/${savedSlug}`)) {
    return { pattern: `${url.slice(0, url.length - savedSlug.length)}{slug}` };
  }
  return info.siteStart ? { pattern: routePattern, fixedAddress: url } : { pattern: routePattern };
}
