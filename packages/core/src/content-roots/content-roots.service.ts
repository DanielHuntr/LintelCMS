import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { findEntryOrFail } from "../entries/entries.service.js";
import { NotASiteStartError, RootAddressTakenError } from "./content-roots.errors.js";
import { buildEntryUrl, TREE_PATH_PLACEHOLDER } from "../delivery/entry-urls.js";
import {
  deleteRootAddressRow,
  findEntryAddressRows,
  findEntryPlaces,
  listSiteStartHostnameRows,
  listSiteStartRows,
  saveRootAddressRow,
  type EntryPlaceRow,
  type SiteStartRow,
} from "./content-roots.repository.js";
import type { RootHostnames, SaveRootHostnamesRequest } from "./content-roots.schema.js";
import { addPathPrefix, hostnameMatches, normalizeHostname } from "../sites/site-addresses.js";
import type { Site } from "../sites/sites.table.js";
import {
  addressUnderRoot,
  findAddressClash,
  type PlacedRoot,
  placeSiteStarts,
  type RootAddress,
} from "./root-addresses.js";

/**
 * Site starts (the pages at the top of a page tree) and the addresses of everything under
 * them. Other features build an entry's address from its collection's route pattern as
 * always, then pass it through `placeEntryUrls` to put it under its site start.
 */

/** Deep enough for any real site; stops a broken parent loop from running for ever. */
const MAX_DEPTH = 100;

export interface SiteStartSummary extends PlacedRoot {
  slug: string;
  title: string;
  collection: { handle: string; name: string };
  /** Where it answers: "/", "/shop" or "https://shop.example.com/". */
  url: string;
}

/**
 * The tree's order: page trees in the order they were made, then the order set by hand.
 * Sections used to go by name, so renaming a content type could change which page is "/"
 * (LINTEL-FUNC-018).
 */
function compareSiteStarts(first: SiteStartRow, second: SiteStartRow): number {
  return (
    first.collectionCreatedAt.getTime() - second.collectionCreatedAt.getTime() ||
    first.collectionName.localeCompare(second.collectionName) ||
    first.sortOrder - second.sortOrder ||
    first.createdAt.getTime() - second.createdAt.getTime()
  );
}

function addressOf(row: SiteStartRow): RootAddress | null {
  return row.hostname === null || row.pathPrefix === null
    ? null
    : { hostname: row.hostname, pathPrefix: row.pathPrefix };
}

/** The site starts of one site and language, in order, with where each answers. */
export async function listSiteStarts(
  database: DatabaseOrTransaction,
  siteId: string,
  locale: string,
): Promise<SiteStartSummary[]> {
  const rows = (await listSiteStartRows(database, DEFAULT_TENANT_ID, siteId, locale)).sort(
    compareSiteStarts,
  );
  const placed = placeSiteStarts(
    rows.map((row) => ({ entryId: row.entryId, slug: row.slug, address: addressOf(row) })),
  );
  return rows.flatMap((row, index) => {
    const root = placed[index];
    return root
      ? [
          {
            ...root,
            slug: row.slug,
            title: row.title ?? "",
            collection: { handle: row.collectionHandle, name: row.collectionName },
            url: addressUnderRoot(root, "/"),
          },
        ]
      : [];
  });
}

/** The domains this site's site starts have of their own, in any language. */
export async function listSiteStartHostnames(
  database: DatabaseOrTransaction,
  siteId: string,
): Promise<string[]> {
  const rows = await listSiteStartHostnameRows(database, DEFAULT_TENANT_ID, siteId);
  return rows.map((row) => row.hostname);
}

/**
 * The site whose site start has this domain of its own, if any: with "Hostnames", a page at
 * the top answers on a domain the way a whole site does (see site-for-address.ts).
 */
export async function findSiteIdForSiteStartHost(
  database: DatabaseOrTransaction,
  host: string,
): Promise<string | undefined> {
  const requestHost = normalizeHostname(host);
  if (requestHost === null) {
    return undefined;
  }
  const rows = await listSiteStartHostnameRows(database, DEFAULT_TENANT_ID);
  return rows.find((row) => hostnameMatches(row.hostname, requestHost))?.siteId;
}

/** Where an entry is in its tree: its topmost ancestor, and the slugs on the way down. */
interface TreePlace {
  top: EntryPlaceRow;
  /** Slugs below the top, down to the entry's own: "about/team". "" for the top itself. */
  slugPath: string;
}

/** Each entry's place in its tree (itself at the top), with ancestors read a level at a time. */
async function findTreePlaces(
  database: DatabaseOrTransaction,
  entryIds: readonly string[],
): Promise<Map<string, TreePlace>> {
  const known = new Map<string, EntryPlaceRow>();
  let missing = [...new Set(entryIds)];
  for (let depth = 0; missing.length > 0 && depth < MAX_DEPTH; depth += 1) {
    for (const row of await findEntryPlaces(database, missing)) {
      known.set(row.id, row);
    }
    missing = [...known.values()]
      .map((row) => row.parentId)
      .filter((parentId): parentId is string => parentId !== null && !known.has(parentId));
  }
  const places = new Map<string, TreePlace>();
  for (const entryId of entryIds) {
    const slugs: string[] = [];
    let current = known.get(entryId);
    for (let depth = 0; current?.parentId && depth < MAX_DEPTH; depth += 1) {
      slugs.unshift(current.slug);
      current = known.get(current.parentId);
    }
    if (current && current.parentId === null) {
      places.set(entryId, { top: current, slugPath: slugs.join("/") });
    }
  }
  return places;
}

export interface RootPlace extends PlacedRoot {
  /** The entry is the site start itself. */
  isRoot: boolean;
}

/** The site start each entry is under, if it is under one, and where that answers. */
export async function findRootPlaces(
  database: DatabaseOrTransaction,
  entryIds: readonly string[],
): Promise<Map<string, RootPlace>> {
  return (await findPlaces(database, entryIds)).roots;
}

async function findPlaces(
  database: DatabaseOrTransaction,
  entryIds: readonly string[],
): Promise<{ roots: Map<string, RootPlace>; trees: Map<string, TreePlace> }> {
  const trees = await findTreePlaces(database, entryIds);
  const startsByPlace = new Map<string, Map<string, PlacedRoot>>();
  for (const { top } of trees.values()) {
    const key = `${top.siteId} ${top.locale}`;
    if (!startsByPlace.has(key)) {
      const starts = await listSiteStarts(database, top.siteId, top.locale);
      startsByPlace.set(key, new Map(starts.map((start) => [start.entryId, start])));
    }
  }
  const roots = new Map<string, RootPlace>();
  for (const [entryId, { top }] of trees) {
    const root = startsByPlace.get(`${top.siteId} ${top.locale}`)?.get(top.id);
    if (root) {
      roots.set(entryId, {
        entryId: root.entryId,
        hostname: root.hostname,
        pathPrefix: root.pathPrefix,
        isDefault: root.isDefault,
        isAssigned: root.isAssigned,
        isRoot: entryId === top.id,
      });
    }
  }
  return { roots, trees };
}

/**
 * Fills in `{path}`, the page's place in its tree. Under a site start it is the slugs below
 * the site start ("about/team"), since the site start is "/"; elsewhere in a tree it is every
 * slug from the top down.
 */
function fillTreePath(url: string, tree: TreePlace | undefined, isUnderStart: boolean): string {
  if (!url.includes(TREE_PATH_PLACEHOLDER) || !tree) {
    return url;
  }
  const slugPath = isUnderStart
    ? tree.slugPath
    : [tree.top.slug, tree.slugPath].filter(Boolean).join("/");
  return url.replace(TREE_PATH_PLACEHOLDER, slugPath);
}

/** What placing an address needs to know of the site it is shown on. */
export type AddressSite = Pick<Site, "pathPrefix">;

/**
 * Where an address answers, from its place under a site start and its site. Under a site
 * start with a domain of its own, it is a full address on that domain, which belongs to the
 * site with no prefix (see site-for-address.ts); otherwise it is a path with the site's
 * prefix in front ("/fr" + "/shop" + "/about").
 */
function placeAddress(place: RootPlace | undefined, url: string, site: AddressSite): string {
  if (!place) {
    return addPathPrefix(site.pathPrefix, url) ?? url;
  }
  const underRoot = addressUnderRoot(place, place.isRoot ? "/" : url);
  return place.hostname === ""
    ? (addPathPrefix(site.pathPrefix, underRoot) ?? underRoot)
    : underRoot;
}

const NO_SITE: AddressSite = { pathPrefix: "" };

/**
 * Addresses built from route patterns ("/about"), put under their site starts and their
 * site: a site start itself is its own "/", what's under the second one is "/shop/about",
 * and on a site served under /fr that is "/fr/shop/about". Entries that aren't under a site
 * start (posts, products) keep the address they came with, with the site's prefix.
 *
 * `site` is the site the addresses are shown on; an address may name its own instead.
 */
export async function placeEntryUrls(
  database: DatabaseOrTransaction,
  addresses: ReadonlyArray<{ id: string; url: string | null; site?: AddressSite }>,
  options: { site?: AddressSite } = {},
): Promise<Map<string, string | null>> {
  const withAddress = addresses.filter((address) => address.url !== null);
  const { roots, trees } = await findPlaces(
    database,
    withAddress.map((address) => address.id),
  );
  return new Map(
    addresses.map((address) => {
      if (address.url === null) {
        return [address.id, null];
      }
      const site = address.site ?? options.site ?? NO_SITE;
      const root = roots.get(address.id);
      const url = fillTreePath(address.url, trees.get(address.id), root !== undefined);
      return [address.id, placeAddress(root, url, site)];
    }),
  );
}

/** `placeEntryUrls` for one entry. */
export async function placeEntryUrl(
  database: DatabaseOrTransaction,
  entryId: string,
  url: string | null,
  options: { site?: AddressSite } = {},
): Promise<string | null> {
  return (await placeEntryUrls(database, [{ id: entryId, url }], options)).get(entryId) ?? url;
}

/**
 * The addresses of the live pages among these entries, with their titles: what a move
 * compares before and after, to offer redirects from addresses people may have saved.
 */
export async function findLiveAddresses(
  database: DatabaseOrTransaction,
  entryIds: readonly string[],
): Promise<Map<string, { title: string; url: string }>> {
  const rows = (await findEntryAddressRows(database, entryIds)).filter(
    (row) => row.status === "published",
  );
  const urls = await placeEntryUrls(
    database,
    rows.map((row) => ({ id: row.id, url: buildEntryUrl(row.routePattern, row) })),
  );
  const live = new Map<string, { title: string; url: string }>();
  for (const row of rows) {
    const url = urls.get(row.id);
    if (url) {
      live.set(row.id, { title: row.title ?? "", url });
    }
  }
  return live;
}

async function findSiteStartOrFail(
  database: DatabaseOrTransaction,
  entryId: string,
): Promise<{ start: SiteStartSummary; starts: SiteStartSummary[] }> {
  const entry = await findEntryOrFail(database, entryId);
  const starts = await listSiteStarts(database, entry.siteId, entry.locale);
  const start = starts.find((candidate) => candidate.entryId === entryId);
  if (!start) {
    throw new NotASiteStartError();
  }
  return { start, starts };
}

function describeHostnames(start: SiteStartSummary): RootHostnames {
  return {
    entryId: start.entryId,
    hostname: start.isAssigned ? start.hostname : "",
    pathPrefix: start.isAssigned ? start.pathPrefix : "",
    isAssigned: start.isAssigned,
    isDefault: start.isDefault,
    url: start.url,
  };
}

/** What "Hostnames" shows for a site start: its own address, if set, and where it answers. */
export async function readRootHostnames(
  database: DatabaseOrTransaction,
  entryId: string,
): Promise<RootHostnames> {
  const { start } = await findSiteStartOrFail(database, entryId);
  return describeHostnames(start);
}

/**
 * Gives a site start a domain and/or path prefix, or (both empty) takes it back to the
 * default. Two site starts can't answer on the same domain and prefix.
 */
export async function saveRootHostnames(
  database: DatabaseOrTransaction,
  entryId: string,
  request: SaveRootHostnamesRequest,
): Promise<RootHostnames> {
  const { starts } = await findSiteStartOrFail(database, entryId);
  if (request.hostname === "" && request.pathPrefix === "") {
    await deleteRootAddressRow(database, DEFAULT_TENANT_ID, entryId);
    return readRootHostnames(database, entryId);
  }
  const address = { hostname: request.hostname, pathPrefix: request.pathPrefix };
  const replanned = placeSiteStarts(
    starts.map((start) => ({
      entryId: start.entryId,
      slug: start.slug,
      address:
        start.entryId === entryId
          ? address
          : start.isAssigned
            ? { hostname: start.hostname, pathPrefix: start.pathPrefix }
            : null,
    })),
  );
  const clash = findAddressClash(
    address,
    replanned.filter((root) => root.entryId !== entryId),
  );
  if (clash) {
    const other = starts.find((start) => start.entryId === clash.entryId);
    throw new RootAddressTakenError(addressUnderRoot(address, "/"), other?.title ?? "");
  }
  await saveRootAddressRow(database, DEFAULT_TENANT_ID, entryId, address);
  return readRootHostnames(database, entryId);
}
