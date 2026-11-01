/**
 * The address rules for site starts: the pages at the top of a page tree. Pure functions,
 * so the rules are easy to test; content-roots.service.ts feeds them from the database.
 *
 * A site start is its site's "/" and its children are "/about", never "/home/about". With
 * several, the first in the tree's order is "/" and the others answer under their own
 * slug ("/shop", "/shop/about"), unless "Hostnames" gives one a domain or a path prefix.
 *
 * The domain and prefix rules (tidying, matching, the longest prefix winning) are a site's
 * in multisite, from sites/site-addresses.ts; see the content-roots README for how the two
 * meet.
 */

import {
  addPathPrefix,
  hostnameMatches,
  isUnderPrefix,
  normalizeHostname,
} from "../sites/site-addresses.js";

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

/**
 * A site start's domain, tidied as a site's are ("https://Shop.Example.com/" is
 * "shop.example.com"), except that "" stays "" here: no domain of its own.
 * Null for anything that isn't a domain.
 */
export function normalizeRootHostname(value: string): string | null {
  return value.trim() === "" ? "" : normalizeHostname(value);
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
  const withPrefix = addPathPrefix(root.pathPrefix, path) ?? path;
  return root.hostname === "" ? withPrefix : `https://${root.hostname}${withPrefix}`;
}

/**
 * The site start a path belongs to: the longest prefix that fits. A site start with a domain
 * of its own answers only on that domain, and there it comes before the ones without. With
 * no host given, only the site starts without a domain are considered.
 */
export function matchRootForPath<Root extends PlacedRoot>(
  roots: readonly Root[],
  path: string,
  host?: string,
): Root | undefined {
  const lowered = path.toLowerCase();
  const requestHost = host === undefined ? null : normalizeHostname(host);
  const onHost = (root: Root): boolean =>
    root.hostname !== "" && requestHost !== null && hostnameMatches(root.hostname, requestHost);
  return roots
    .filter(
      (root) => (root.hostname === "" || onHost(root)) && isUnderPrefix(lowered, root.pathPrefix),
    )
    .sort(
      (first, second) =>
        Number(onHost(second)) - Number(onHost(first)) ||
        second.pathPrefix.length - first.pathPrefix.length,
    )[0];
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
