/**
 * Which site an address belongs to, and the tidying that makes addresses comparable. Pure
 * functions, so the rules are easy to test; request-site.ts uses them for each request.
 *
 * A site answers on its hostnames, under its path prefix: "acme.com" with "/fr" means
 * https://acme.com/fr and everything below it. When several sites share a domain, the
 * longest prefix that fits wins, so "/fr/about" goes to the French site and "/about" to
 * the one without a prefix.
 */

export interface AddressedSite {
  hostnames: readonly string[];
  pathPrefix: string;
}

const HOSTNAME_PATTERN =
  /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*(:\d{1,5})?$/;
const PATH_SEGMENT_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/**
 * "https://www.Acme.co.uk/about" becomes "www.acme.co.uk"; "localhost:3000" stays as it is.
 * Null for anything that isn't a domain.
 */
export function normalizeHostname(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "") {
    return null;
  }
  let host: string;
  try {
    host = new URL(trimmed.includes("://") ? trimmed : `http://${trimmed}`).host;
  } catch {
    return null;
  }
  // URL drops a port that is the protocol's default; anything else it keeps.
  return HOSTNAME_PATTERN.test(host) ? host : null;
}

/** "fr/", "/FR" and "/fr/" become "/fr"; "" and "/" mean no prefix. Null when not a path. */
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

/** Whether a site hostname covers the one a request came to. No port on the site means any. */
export function hostnameMatches(siteHostname: string, requestHost: string): boolean {
  if (siteHostname === requestHost) {
    return true;
  }
  return !siteHostname.includes(":") && requestHost.split(":")[0] === siteHostname;
}

/** Whether a path is the prefix itself or somewhere below it. */
export function isUnderPrefix(path: string, prefix: string): boolean {
  return prefix === "" || path === prefix || path.startsWith(`${prefix}/`);
}

/**
 * The site for a domain and, when known, a path. Without a path, a site with no prefix is
 * preferred, then the first in the list. Undefined when no site lists the domain.
 *
 * A site with a path prefix and no domains of its own ("/ie") answers on the default
 * site's domain: the default site's own domains, or, when it lists none, any domain no
 * site lists. So `defaultSite` is needed for those sites to be found.
 */
export function matchSiteForAddress<Site extends AddressedSite>(
  sites: readonly Site[],
  address: { host: string; path?: string },
  defaultSite?: AddressedSite,
): Site | undefined {
  const host = normalizeHostname(address.host);
  if (host === null) {
    return undefined;
  }
  const onHost = sites.filter((site) =>
    site.hostnames.some((hostname) => hostnameMatches(hostname, host)),
  );
  if (address.path === undefined) {
    return onHost.find((site) => site.pathPrefix === "") ?? onHost[0];
  }
  const isDefaultDomain =
    defaultSite !== undefined &&
    (defaultSite.hostnames.length === 0
      ? onHost.length === 0
      : defaultSite.hostnames.some((hostname) => hostnameMatches(hostname, host)));
  const pathOnly = isDefaultDomain
    ? sites.filter((site) => site.hostnames.length === 0 && site.pathPrefix !== "")
    : [];
  const path = address.path.toLowerCase();
  return [...onHost, ...pathOnly]
    .filter((site) => isUnderPrefix(path, site.pathPrefix))
    .sort((first, second) => second.pathPrefix.length - first.pathPrefix.length)[0];
}

/** An address within the site, with its prefix: "/about" on the French site is "/fr/about". */
export function addPathPrefix(prefix: string, path: string | null): string | null {
  if (path === null || prefix === "") {
    return path;
  }
  return path === "/" ? prefix : `${prefix}${path}`;
}

/** The reverse of addPathPrefix: "/fr/about" is "/about" on the French site. */
export function removePathPrefix(prefix: string, path: string): string {
  if (prefix === "" || !isUnderPrefix(path.toLowerCase(), prefix)) {
    return path;
  }
  return path.slice(prefix.length) || "/";
}

/** Two sites can't answer on the same domain and prefix; the first clash found, if any. */
export function findAddressClash(
  site: AddressedSite,
  others: readonly (AddressedSite & { name: string })[],
): { hostname: string; siteName: string } | undefined {
  for (const other of others) {
    if (other.pathPrefix !== site.pathPrefix) {
      continue;
    }
    const hostname = site.hostnames.find((candidate) => other.hostnames.includes(candidate));
    if (hostname !== undefined) {
      return { hostname, siteName: other.name };
    }
  }
  return undefined;
}
