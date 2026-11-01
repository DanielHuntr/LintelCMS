/**
 * The address rules for site starts: the pages at the top of a page tree. Pure functions,
 * so the rules are easy to test; content-roots.service.ts feeds them from the database.
 *
 * A site start is its site's "/" and its children are "/about", never "/home/about". With
 * several, the first in the tree's order is "/" and the others answer under their own
 * slug ("/shop", "/shop/about"), unless "Hostnames" gives one a domain or a path prefix.
 *
 * The domain and prefix rules (tidying, matching, the longest prefix winning) are the
 * same as a site's in multisite; see the content-roots README for how the two meet.
 */

export interface RootAddress {
  /** A domain such as "shop.example.com", or "" for the site's own. */
  hostname: string;
  /** A path such as "/shop", or "" for none. */
  pathPrefix: string;
}

export interface SiteStart {
  entryId: string;
  slug: string;
  /** Set in "Hostnames", or null to take the default. */
  address: RootAddress | null;
}

/** A site start with the address it answers on. */
export interface PlacedRoot extends RootAddress {
  entryId: string;
  /** Takes "/" because it is the first site start without an address of its own. */
  isDefault: boolean;
  /** Has a domain or path of its own, from "Hostnames". */
  isAssigned: boolean;
}

const HOSTNAME_PATTERN =
  /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*(:\d{1,5})?$/;
const PATH_SEGMENT_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/**
 * "https://Shop.Example.com/about" becomes "shop.example.com"; "" stays "" (no domain).
 * Null for anything that isn't a domain.
 */
export function normalizeHostname(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "") {
    return "";
  }
  let host: string;
  try {
    host = new URL(trimmed.includes("://") ? trimmed : `http://${trimmed}`).host;
  } catch {
    return null;
  }
  return HOSTNAME_PATTERN.test(host) ? host : null;
}

/** "shop/", "/Shop" and "/shop/" become "/shop"; "" and "/" mean no prefix. Null when not a path. */
export function normalizePathPrefix(value: string): string | null {
  const segments = value
    .trim()
    .toLowerCase()
    .split("/")
    .filter((segment) => segment !== "");
  if (segments.length === 0) {
    return "";
  }
  return segments.every((segment) => PATH_SEGMENT_PATTERN.test(segment))
    ? `/${segments.join("/")}`
    : null;
}

/**
 * Where each site start answers, in the order given (the tree's). One with an address keeps
 * it. The first without one is "/", unless another already claims "/" on the site's own
 * domain; the rest answer under their slug.
 */
export function placeSiteStarts(starts: readonly SiteStart[]): PlacedRoot[] {
  let isTopTaken = starts.some(
    (start) => start.address?.hostname === "" && start.address.pathPrefix === "",
  );
  return starts.map((start) => {
    if (start.address) {
      return { entryId: start.entryId, ...start.address, isDefault: false, isAssigned: true };
    }
    if (!isTopTaken) {
      isTopTaken = true;
      return {
        entryId: start.entryId,
        hostname: "",
        pathPrefix: "",
        isDefault: true,
        isAssigned: false,
      };
    }
    return {
      entryId: start.entryId,
      hostname: "",
      pathPrefix: `/${start.slug}`,
      isDefault: false,
      isAssigned: false,
    };
  });
}

/**
 * A path from a route pattern, under a site start: "/about" under "/shop" is "/shop/about",
 * and with a domain it is a full address, "https://shop.example.com/about".
 */
export function addressUnderRoot(root: RootAddress, path: string): string {
  const withPrefix =
    root.pathPrefix === "" ? path : path === "/" ? root.pathPrefix : `${root.pathPrefix}${path}`;
  return root.hostname === "" ? withPrefix : `https://${root.hostname}${withPrefix}`;
}

/** Whether a path is the prefix itself or somewhere below it. */
export function isUnderPrefix(path: string, prefix: string): boolean {
  return prefix === "" || path === prefix || path.startsWith(`${prefix}/`);
}

/** The reverse of addressUnderRoot's prefix: "/shop/about" is "/about" under "/shop". */
export function removePathPrefix(prefix: string, path: string): string {
  if (prefix === "" || !isUnderPrefix(path.toLowerCase(), prefix)) {
    return path;
  }
  return path.slice(prefix.length) || "/";
}

/**
 * The site start a path on the site's own domain belongs to: the longest prefix that fits.
 * Site starts with a domain of their own answer there, not here.
 */
export function matchRootForPath<Root extends PlacedRoot>(
  roots: readonly Root[],
  path: string,
): Root | undefined {
  const lowered = path.toLowerCase();
  return roots
    .filter((root) => root.hostname === "" && isUnderPrefix(lowered, root.pathPrefix))
    .sort((first, second) => second.pathPrefix.length - first.pathPrefix.length)[0];
}

/** Two site starts can't answer on the same domain and prefix: the one in the way, if any. */
export function findAddressClash<Root extends PlacedRoot>(
  address: RootAddress,
  others: readonly Root[],
): Root | undefined {
  return others.find(
    (other) => other.hostname === address.hostname && other.pathPrefix === address.pathPrefix,
  );
}

/** Just the path of an address, for comparing a full address with the path visited. */
export function pathOfAddress(address: string): string {
  if (address.startsWith("/")) {
    return address;
  }
  try {
    return new URL(address).pathname;
  } catch {
    return address;
  }
}
