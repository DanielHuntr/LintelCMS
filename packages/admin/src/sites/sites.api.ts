import { apiRequest } from "../api/client.js";
import type { Collection } from "../content/content.types.js";
import type {
  CollectionSiteScope,
  NewSite,
  RoleSiteAccess,
  Site,
  SiteChanges,
} from "./sites.types.js";

/** Calls to the API's site routes. One function per route. */

export async function listSites(): Promise<Site[]> {
  const { sites } = await apiRequest<{ sites: Site[] }>("/sites");
  return sites;
}

export function createSite(site: NewSite): Promise<Site> {
  return apiRequest<Site>("/sites", { method: "POST", body: site });
}

export function updateSite(handle: string, changes: SiteChanges): Promise<Site> {
  return apiRequest<Site>(`/sites/${encodeURIComponent(handle)}`, {
    method: "PATCH",
    body: changes,
  });
}

export function deleteSite(handle: string): Promise<void> {
  return apiRequest<void>(`/sites/${encodeURIComponent(handle)}`, { method: "DELETE" });
}

export async function listRoleSiteAccess(): Promise<RoleSiteAccess[]> {
  const { roles } = await apiRequest<{ roles: RoleSiteAccess[] }>("/sites/access");
  return roles;
}

export function setRoleSiteAccess(
  roleHandle: string,
  siteHandles: string[] | null,
): Promise<RoleSiteAccess> {
  return apiRequest<RoleSiteAccess>(`/sites/access/${encodeURIComponent(roleHandle)}`, {
    method: "PUT",
    body: { siteHandles },
  });
}

/** Every collection, not only the current site's, for choosing where each one is used. */
export async function listAllCollections(): Promise<Collection[]> {
  const { collections } = await apiRequest<{ collections: Collection[] }>("/collections?site=all");
  return collections;
}

export function saveCollectionSites(
  collectionHandle: string,
  changes: { siteScope: CollectionSiteScope; siteHandles: string[] | null },
): Promise<Collection> {
  return apiRequest<Collection>(`/collections/${encodeURIComponent(collectionHandle)}`, {
    method: "PUT",
    body: changes,
  });
}

/** Starts a draft copy of an entry on another site. */
export function copyEntryToSite(entryId: string, siteHandle: string): Promise<{ id: string }> {
  return apiRequest<{ id: string }>(`/entries/${encodeURIComponent(entryId)}/copy-to-site`, {
    method: "POST",
    body: { site: siteHandle },
  });
}
