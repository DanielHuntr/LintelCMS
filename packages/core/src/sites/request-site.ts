import type { FastifyReply, FastifyRequest } from "fastify";
import type { SignedIn } from "../auth/auth.schema.js";
import { findEntryById } from "../entries/entries.repository.js";
import { matchSiteForAddress } from "./site-addresses.js";
import { SiteAccessDeniedError } from "./sites.errors.js";
import {
  findOrCreateDefaultSite,
  findSiteByIdOrFail,
  findSiteOrFail,
  isDefaultSite,
  listAllSites,
} from "./sites.service.js";
import type { Site } from "./sites.table.js";

/**
 * Which site a request is about. Routes call one of these and pass the site on to their
 * service; nothing here is stored on the request, so every route says what it uses.
 *
 * - Websites (`resolveDeliverySite`): `?site=<handle>`, else the `Lintel-Site` header, else
 *   the domain the request came to (`X-Forwarded-Host` behind a proxy, else `Host`), else
 *   the default site. An unknown handle is a 404, so a typo fails loudly.
 * - The admin (`resolveEditingSite`): `?site=` or the `Lintel-Site` header the admin sends
 *   with every request, else the default site. The signed-in person must be allowed on it.
 */
export const SITE_HEADER = "lintel-site";

function requestedSiteHandle(request: FastifyRequest): string | undefined {
  const query = request.query;
  const fromQuery =
    typeof query === "object" && query !== null && "site" in query ? query.site : undefined;
  if (typeof fromQuery === "string" && fromQuery !== "") {
    return fromQuery;
  }
  const header = request.headers[SITE_HEADER];
  return typeof header === "string" && header !== "" ? header : undefined;
}

/** The domain the visitor asked for. A proxy in front of the API passes it on. */
function requestHost(request: FastifyRequest): string | undefined {
  const forwarded = request.headers["x-forwarded-host"];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
  return first || request.headers.host;
}

export async function resolveDeliverySite(
  request: FastifyRequest,
  reply?: FastifyReply,
): Promise<Site> {
  // Shared caches must keep each site's answer apart when only a header tells them apart.
  reply?.header("vary", "Lintel-Site, X-Forwarded-Host");
  const database = request.server.database;
  const handle = requestedSiteHandle(request);
  if (handle !== undefined) {
    return findSiteOrFail(database, handle);
  }
  const sites = await listAllSites(database);
  const host = requestHost(request);
  const matched = sites.length > 1 && host ? matchSiteForAddress(sites, { host }) : undefined;
  return matched ?? sites.find(isDefaultSite) ?? findOrCreateDefaultSite(database);
}

export async function resolveEditingSite(request: FastifyRequest): Promise<Site> {
  const database = request.server.database;
  const handle = requestedSiteHandle(request);
  const site =
    handle === undefined
      ? await findOrCreateDefaultSite(database)
      : await findSiteOrFail(database, handle);
  checkSiteAccess(request.signedIn, site);
  return site;
}

/** Whether someone may work on a site: their roles allow every site, or this one. */
export function canWorkOnSite(signedIn: Pick<SignedIn, "siteIds">, siteId: string): boolean {
  return (
    signedIn.siteIds === null || signedIn.siteIds === undefined || signedIn.siteIds.includes(siteId)
  );
}

/** A 403 that names the site, for someone whose roles don't include it. */
export function checkSiteAccess(signedIn: SignedIn | null, site: Site): void {
  if (signedIn && !canWorkOnSite(signedIn, site.id)) {
    throw new SiteAccessDeniedError(site.name);
  }
}

/**
 * A preHandler for `/entries/:id...` routes, after the permission check: someone limited to
 * some sites can't open or change another site's entries by id. An unknown id is left for
 * the route to answer with its own 404.
 */
export async function requireEntrySiteAccess(request: FastifyRequest): Promise<void> {
  const signedIn = request.signedIn;
  const params = request.params;
  if (!signedIn || signedIn.siteIds === null || signedIn.siteIds === undefined) {
    return;
  }
  const entryId =
    typeof params === "object" && params !== null && "id" in params ? params.id : undefined;
  if (typeof entryId !== "string" || !/^[0-9a-f-]{36}$/i.test(entryId)) {
    return;
  }
  const entry = await findEntryById(request.server.database, entryId);
  if (entry && !canWorkOnSite(signedIn, entry.siteId)) {
    throw new SiteAccessDeniedError(
      (await findSiteByIdOrFail(request.server.database, entry.siteId)).name,
    );
  }
}
