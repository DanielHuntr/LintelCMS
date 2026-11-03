/**
 * A link to a page of the site, stored as the page itself rather than its address:
 * `lintel:page/<entry id>`. Wherever a link is drawn, Lintel swaps it for the page's address
 * at that moment, so the link keeps working when the page moves or is renamed. Typed
 * addresses ("/about", "https://…") are left exactly as they are.
 *
 * It is a plain string so it fits every place that already holds an address: the href of a
 * link in rich text, a Link field's `url`, and the builder's link props. See
 * docs/decisions/0032-links-to-pages-by-id.md.
 */
export const PAGE_LINK_PREFIX = "lintel:page/";

const entryIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The stored form of a link to this page. */
export function pageLinkHref(entryId: string): string {
  return `${PAGE_LINK_PREFIX}${entryId}`;
}

/** The page a link points at, or null when it is an ordinary address. */
export function readPageLinkId(href: unknown): string | null {
  if (typeof href !== "string") return null;
  const trimmed = href.trim();
  if (!trimmed.toLowerCase().startsWith(PAGE_LINK_PREFIX)) return null;
  const entryId = trimmed.slice(PAGE_LINK_PREFIX.length);
  return entryIdPattern.test(entryId) ? entryId.toLowerCase() : null;
}

export function isPageLinkHref(href: unknown): boolean {
  return readPageLinkId(href) !== null;
}

/** What a page link becomes: the page's current address, or null when it is gone. */
export type PageAddressLookup = (entryId: string) => string | null;

/**
 * Every page a value links to, anywhere inside it: rich text, link fields, a page's design.
 * Strings are read whole, so only a complete `lintel:page/<id>` counts.
 */
export function collectPageLinkIds(value: unknown, into: Set<string> = new Set()): Set<string> {
  const waiting: unknown[] = [value];
  while (waiting.length > 0) {
    const current = waiting.pop();
    if (typeof current === "string") {
      const entryId = readPageLinkId(current);
      if (entryId) into.add(entryId);
    } else if (Array.isArray(current)) {
      waiting.push(...(current as unknown[]));
    } else if (typeof current === "object" && current !== null) {
      waiting.push(...Object.values(current));
    }
  }
  return into;
}

/**
 * A copy of the value with every page link swapped for the page's address. A link to a page
 * that is gone becomes "" (no link), which elements draw as plain words. Anything else is
 * kept as it was, so a page's design can be passed through whole.
 */
export function resolvePageLinks<Value>(value: Value, addressOf: PageAddressLookup): Value {
  return resolveAny(value, addressOf) as Value;
}

function resolveAny(value: unknown, addressOf: PageAddressLookup): unknown {
  if (typeof value === "string") {
    const entryId = readPageLinkId(value);
    return entryId ? (addressOf(entryId) ?? "") : value;
  }
  if (Array.isArray(value)) return value.map((item) => resolveAny(item, addressOf));
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [key, resolveAny(inner, addressOf)]),
    );
  }
  return value;
}
