import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import type { SignedIn } from "../auth/auth.schema.js";
import { findRoleByHandle, listRoleRows, updateRoleSiteIds } from "../roles/roles.repository.js";
import { checkRoleCanBeGranted } from "../roles/roles.service.js";
import { checkSiteAccess } from "./request-site.js";
import { EverySiteDeniedError, RoleNotFoundError } from "./sites.errors.js";
import { findSiteByIdOrFail, findSiteOrFail, listAllSites } from "./sites.service.js";

/**
 * Which sites each role may work on. Every role starts open to every site; limiting one
 * keeps its people to the sites chosen, in the admin and through API tokens they make.
 */

export interface RoleSiteAccess {
  handle: string;
  name: string;
  /** Null for every site. */
  siteHandles: string[] | null;
}

export async function listRoleSiteAccess(
  database: DatabaseOrTransaction,
): Promise<{ roles: RoleSiteAccess[] }> {
  const sites = await listAllSites(database);
  const handleOf = new Map(sites.map((site) => [site.id, site.handle]));
  const roles = await listRoleRows(database, DEFAULT_TENANT_ID);
  return {
    roles: roles.map((role) => ({
      handle: role.handle,
      name: role.name,
      siteHandles:
        role.siteIds === null
          ? null
          : role.siteIds.flatMap((siteId) => {
              const handle = handleOf.get(siteId);
              return handle === undefined ? [] : [handle];
            }),
    })),
  };
}

/**
 * Which sites a role may work on. Only for a role the actor could give out themselves (so
 * not the Owner role, unless they are an owner), and someone limited to some sites can only
 * move the role among those: never lift their own limit, nor take another site from it.
 */
export async function setRoleSiteAccess(
  database: DatabaseOrTransaction,
  actor: SignedIn,
  roleHandle: string,
  siteHandles: readonly string[] | null,
): Promise<RoleSiteAccess> {
  const role = await findRoleByHandle(database, DEFAULT_TENANT_ID, roleHandle);
  if (!role) {
    throw new RoleNotFoundError(roleHandle);
  }
  checkRoleCanBeGranted(role, actor.permissions);
  const actorIsLimited = actor.siteIds !== null && actor.siteIds !== undefined;
  if (actorIsLimited && (siteHandles === null || role.siteIds === null)) {
    throw new EverySiteDeniedError();
  }
  for (const siteId of role.siteIds ?? []) {
    checkSiteAccess(actor, await findSiteByIdOrFail(database, siteId));
  }
  const sites =
    siteHandles === null
      ? null
      : await Promise.all(
          [...new Set(siteHandles)].map((handle) => findSiteOrFail(database, handle)),
        );
  for (const site of sites ?? []) {
    checkSiteAccess(actor, site);
  }
  await updateRoleSiteIds(database, role.id, sites === null ? null : sites.map((site) => site.id));
  return {
    handle: role.handle,
    name: role.name,
    siteHandles: sites === null ? null : sites.map((site) => site.handle),
  };
}
