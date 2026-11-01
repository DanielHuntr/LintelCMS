import type { Database } from "../database/client.js";
import { findPermissionListsForUser, findSiteListsForUser } from "./roles.repository.js";

/**
 * Everything a user may do: the permissions of all their roles combined, without
 * duplicates. Sorted so the admin (and tests) always see them in the same order.
 */
export async function findPermissionsForUser(
  database: Database,
  userId: string,
): Promise<string[]> {
  const permissionLists = await findPermissionListsForUser(database, userId);
  const combined = new Set(permissionLists.flat());
  return [...combined].sort();
}

/**
 * The sites a user may work on: null for every site, which is what anyone has unless all
 * of their roles are limited to some sites. With several roles, any site one allows counts.
 */
export async function findSiteIdsForUser(
  database: Database,
  userId: string,
): Promise<string[] | null> {
  const siteLists = await findSiteListsForUser(database, userId);
  if (siteLists.length === 0 || siteLists.some((siteIds) => siteIds === null)) {
    return null;
  }
  return [...new Set(siteLists.flatMap((siteIds) => siteIds ?? []))].sort();
}
