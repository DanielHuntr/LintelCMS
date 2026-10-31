import type { Database } from "../database/client.js";
import { findPermissionListsForUser } from "./roles.repository.js";

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
