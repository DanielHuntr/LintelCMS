import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { findEntryOrFail } from "../entries/entries.service.js";
import { NotASiteStartError, RootAddressTakenError } from "./content-roots.errors.js";
import { buildEntryUrl } from "../delivery/entry-urls.js";
import {
  deleteRootAddressRow,
  findEntryAddressRows,
  findEntryPlaces,
  listSiteStartRows,
  saveRootAddressRow,
  type EntryPlaceRow,
  type SiteStartRow,
} from "./content-roots.repository.js";
import type { RootHostnames, SaveRootHostnamesRequest } from "./content-roots.schema.js";
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

/** The tree's order: sections by name (they are all page trees), then the order set by hand. */
function compareSiteStarts(first: SiteStartRow, second: SiteStartRow): number {
  return (
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

/** Each entry's topmost ancestor (itself at the top), read a level at a time. */
async function findTops(
  database: DatabaseOrTransaction,
  entryIds: readonly string[],
): Promise<Map<string, EntryPlaceRow>> {
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
  const tops = new Map<string, EntryPlaceRow>();
  for (const entryId of entryIds) {
    let current = known.get(entryId);
    for (let depth = 0; current?.parentId && depth < MAX_DEPTH; depth += 1) {
      current = known.get(current.parentId);
    }
    if (current && current.parentId === null) {
      tops.set(entryId, current);
    }
  }
  return tops;
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
  const tops = await findTops(database, entryIds);
  const startsByPlace = new Map<string, Map<string, PlacedRoot>>();
  for (const top of tops.values()) {
    const key = `${top.siteId} ${top.locale}`;
    if (!startsByPlace.has(key)) {
      const starts = await listSiteStarts(database, top.siteId, top.locale);
      startsByPlace.set(key, new Map(starts.map((start) => [start.entryId, start])));
    }
  }
  const places = new Map<string, RootPlace>();
  for (const [entryId, top] of tops) {
    const root = startsByPlace.get(`${top.siteId} ${top.locale}`)?.get(top.id);
    if (root) {
      places.set(entryId, {
        entryId: root.entryId,
        hostname: root.hostname,
        pathPrefix: root.pathPrefix,
        isDefault: root.isDefault,
        isAssigned: root.isAssigned,
        isRoot: entryId === top.id,
      });
    }
  }
  return places;
}

/**
 * Addresses built from route patterns ("/about"), put under their site starts: a site start
 * itself is its own "/", and what's under the second one is "/shop/about". Entries that
 * aren't under a site start (posts, products) keep the address they came with.
 */
export async function placeEntryUrls(
  database: DatabaseOrTransaction,
  addresses: ReadonlyArray<{ id: string; url: string | null }>,
): Promise<Map<string, string | null>> {
  const withAddress = addresses.filter((address) => address.url !== null);
  const places = await findRootPlaces(
    database,
    withAddress.map((address) => address.id),
  );
  return new Map(
    addresses.map((address) => {
      const place = places.get(address.id);
      if (address.url === null || !place) {
        return [address.id, address.url];
      }
      return [address.id, addressUnderRoot(place, place.isRoot ? "/" : address.url)];
    }),
  );
}

/** `placeEntryUrls` for one entry. */
export async function placeEntryUrl(
  database: DatabaseOrTransaction,
  entryId: string,
  url: string | null,
): Promise<string | null> {
  return (await placeEntryUrls(database, [{ id: entryId, url }])).get(entryId) ?? url;
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
