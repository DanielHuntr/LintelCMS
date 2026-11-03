import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { findEnabledPluginIds } from "../plugins/plugins.service.js";
import { builtInRoles, OWNER_ROLE_HANDLE } from "./built-in-roles.js";
import {
  corePermissionGroups,
  isKnownPermission,
  permissionGroups,
  type PermissionGroup,
} from "./permission-catalog.js";
import { hasPermission } from "./permissions.js";
import {
  BuiltInRoleError,
  CannotGrantPermissionError,
  RoleInUseError,
  RoleNameTakenError,
  RoleNotFoundError,
  UnknownPermissionError,
} from "./roles.errors.js";
import {
  deleteRoleRow,
  findActiveUserIdsWithRole,
  findPermissionListsForUser,
  findRoleById,
  findRolesForUsers,
  findSiteListsForUser,
  insertRole,
  listRoleRows,
  updateRoleRow,
  upsertRoleByHandle,
} from "./roles.repository.js";
import type { CreateRoleRequest, RoleResponse, UpdateRoleRequest } from "./roles.schema.js";
import type { Role } from "./roles.table.js";

/**
 * Everything a user may do: the permissions of all their roles combined, without
 * duplicates. Sorted so the admin (and tests) always see them in the same order.
 */
export async function findPermissionsForUser(
  database: DatabaseOrTransaction,
  userId: string,
): Promise<string[]> {
  const permissionLists = await findPermissionListsForUser(database, userId);
  const combined = new Set(permissionLists.flat());
  return [...combined].sort();
}

/** Whether any of the user's roles asks for two-factor authentication. */
export async function roleRequiresTwoFactor(
  database: DatabaseOrTransaction,
  userId: string,
): Promise<boolean> {
  const roles = await findRolesForUsers(database, [userId]);
  return roles.some((role) => role.requiresTwoFactor);
}

export async function isOwner(database: DatabaseOrTransaction, userId: string): Promise<boolean> {
  const roles = await findRolesForUsers(database, [userId]);
  return roles.some((role) => role.handle === OWNER_ROLE_HANDLE);
}

export function findActiveOwnerIds(database: DatabaseOrTransaction): Promise<string[]> {
  return findActiveUserIdsWithRole(database, DEFAULT_TENANT_ID, OWNER_ROLE_HANDLE);
}

/**
 * Makes sure the five built-in roles exist with their current permissions. Safe to run
 * any number of times; custom roles and "requires two-factor" choices are left alone.
 */
export async function ensureBuiltInRoles(database: DatabaseOrTransaction): Promise<void> {
  for (const role of builtInRoles) {
    await upsertRoleByHandle(database, {
      tenantId: DEFAULT_TENANT_ID,
      handle: role.handle,
      name: role.name,
      description: role.description,
      permissions: role.permissions,
      isBuiltIn: true,
    });
  }
}

export async function listRoles(database: DatabaseOrTransaction): Promise<RoleResponse[]> {
  await ensureBuiltInRoles(database);
  const rows = await listRoleRows(database, DEFAULT_TENANT_ID);
  // Built-in roles in their own order, then the site's own in the order they were made. They
  // used to go by creation time alone, and the built-in ones, made within the same moment,
  // could come out in any order.
  const builtInOrder = (handle: string) => {
    const index = builtInRoles.findIndex((role) => role.handle === handle);
    return index === -1 ? builtInRoles.length : index;
  };
  const ordered = [...rows].sort(
    (first, second) =>
      builtInOrder(first.handle) - builtInOrder(second.handle) ||
      first.createdAt.getTime() - second.createdAt.getTime() ||
      first.name.localeCompare(second.name),
  );
  return ordered.map((row) => describeRole(row, row.memberCount));
}

export async function findRoleOrFail(
  database: DatabaseOrTransaction,
  roleId: string,
): Promise<Role> {
  const role = await findRoleById(database, DEFAULT_TENANT_ID, roleId);
  if (!role) {
    throw new RoleNotFoundError();
  }
  return role;
}

export async function listPermissionGroups(
  database: DatabaseOrTransaction,
): Promise<PermissionGroup[]> {
  return permissionGroups(await findEnabledPluginIds(database));
}

export async function createRole(
  database: DatabaseOrTransaction,
  request: CreateRoleRequest,
  actorPermissions: readonly string[],
): Promise<RoleResponse> {
  checkPermissionsCanBeGranted(request.permissions, actorPermissions);
  await checkNameIsFree(database, request.name);
  const role = await insertRole(database, {
    tenantId: DEFAULT_TENANT_ID,
    handle: await freeHandleFor(database, request.name),
    name: request.name,
    description: request.description,
    permissions: uniqueSorted(request.permissions),
    requiresTwoFactor: request.requiresTwoFactor,
  });
  return describeRole(role, 0);
}

export interface RoleChange {
  before: Role;
  after: RoleResponse;
}

/**
 * Built-in roles only take a change to "requires two-factor"; their names and permissions
 * belong to Lintel. A custom role can change anything, within what the actor may grant.
 */
export async function updateRole(
  database: DatabaseOrTransaction,
  roleId: string,
  changes: UpdateRoleRequest,
  actorPermissions: readonly string[],
): Promise<RoleChange> {
  const role = await findRoleOrFail(database, roleId);
  const changesFixedParts =
    changes.name !== undefined || changes.description !== undefined || changes.permissions;
  if (role.isBuiltIn && changesFixedParts) {
    throw new BuiltInRoleError(role.name, "change its name or what it can do");
  }
  if (changes.permissions) {
    // Removing a permission the actor lacks would be as much a change as adding one.
    const touched = symmetricDifference(role.permissions, changes.permissions);
    checkPermissionsCanBeGranted(touched, actorPermissions);
  }
  if (changes.name !== undefined && changes.name !== role.name) {
    await checkNameIsFree(database, changes.name);
  }

  const updated = await updateRoleRow(database, role.id, {
    ...changes,
    permissions: changes.permissions ? uniqueSorted(changes.permissions) : undefined,
  });
  if (!updated) {
    throw new RoleNotFoundError();
  }
  const rows = await listRoleRows(database, DEFAULT_TENANT_ID);
  const memberCount = rows.find((row) => row.id === role.id)?.memberCount ?? 0;
  return { before: role, after: describeRole(updated, memberCount) };
}

export async function deleteRole(database: DatabaseOrTransaction, roleId: string): Promise<Role> {
  const role = await findRoleOrFail(database, roleId);
  if (role.isBuiltIn) {
    throw new BuiltInRoleError(role.name, "delete it");
  }
  const rows = await listRoleRows(database, DEFAULT_TENANT_ID);
  const memberCount = rows.find((row) => row.id === role.id)?.memberCount ?? 0;
  if (memberCount > 0) {
    throw new RoleInUseError(role.name, memberCount);
  }
  await deleteRoleRow(database, role.id);
  return role;
}

/**
 * Checks that someone may hand out a role: they must be able to do everything it allows.
 * Only owners have "*", so only owners can make someone an owner.
 */
export function checkRoleCanBeGranted(role: Role, actorPermissions: readonly string[]): void {
  checkPermissionsCanBeGranted(role.permissions, actorPermissions, { allowWildcards: true });
}

function checkPermissionsCanBeGranted(
  permissions: readonly string[],
  actorPermissions: readonly string[],
  { allowWildcards = false } = {},
): void {
  for (const permission of permissions) {
    const isWildcard = permission === "*" || permission.endsWith(":*");
    if (!allowWildcards && !isKnownPermission(permission)) {
      throw new UnknownPermissionError(permission);
    }
    const allowed = isWildcard
      ? actorPermissions.includes("*") || actorPermissions.includes(permission)
      : hasPermission(actorPermissions, permission as `${string}:${string}`);
    if (!allowed) {
      throw new CannotGrantPermissionError(permissionName(permission));
    }
  }
}

function permissionName(permission: string): string {
  if (permission === "*") {
    return "everything";
  }
  const known = corePermissionGroups
    .flatMap((group) => group.permissions)
    .find((entry) => entry.permission === permission);
  return known?.name ?? permission;
}

async function checkNameIsFree(database: DatabaseOrTransaction, name: string): Promise<void> {
  await ensureBuiltInRoles(database);
  const rows = await listRoleRows(database, DEFAULT_TENANT_ID);
  if (rows.some((row) => row.name.toLowerCase() === name.toLowerCase())) {
    throw new RoleNameTakenError(name);
  }
}

/** "Shop manager" becomes "shop-manager", or "shop-manager-2" if that is taken. */
async function freeHandleFor(database: DatabaseOrTransaction, name: string): Promise<string> {
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "role";
  const taken = new Set((await listRoleRows(database, DEFAULT_TENANT_ID)).map((row) => row.handle));
  let handle = base;
  for (let suffix = 2; taken.has(handle); suffix++) {
    handle = `${base}-${suffix}`;
  }
  return handle;
}

function uniqueSorted(permissions: readonly string[]): string[] {
  return [...new Set(permissions)].sort();
}

function symmetricDifference(before: readonly string[], after: readonly string[]): string[] {
  return [
    ...after.filter((permission) => !before.includes(permission)),
    ...before.filter((permission) => !after.includes(permission)),
  ];
}

export function describeRole(role: Role, memberCount: number): RoleResponse {
  return {
    id: role.id,
    handle: role.handle,
    name: role.name,
    description: role.description,
    isBuiltIn: role.isBuiltIn,
    requiresTwoFactor: role.requiresTwoFactor,
    permissions: role.permissions,
    memberCount,
  };
}

/**
 * The sites a user may work on: null for every site, which is what anyone has unless all
 * of their roles are limited to some sites. With several roles, any site one allows counts.
 */
export async function findSiteIdsForUser(
  database: DatabaseOrTransaction,
  userId: string,
): Promise<string[] | null> {
  const siteLists = await findSiteListsForUser(database, userId);
  if (siteLists.length === 0 || siteLists.some((siteIds) => siteIds === null)) {
    return null;
  }
  return [...new Set(siteLists.flatMap((siteIds) => siteIds ?? []))].sort();
}
