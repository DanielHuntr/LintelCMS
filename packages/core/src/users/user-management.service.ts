import type { SignedIn } from "../auth/auth.schema.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { findAssetsByIdList } from "../media/media.repository.js";
import { assetFileUrl } from "../media/asset-response.js";
import { OWNER_ROLE_HANDLE } from "../roles/built-in-roles.js";
import { findRolesForUsers, replaceRolesOfUser } from "../roles/roles.repository.js";
import {
  checkRoleCanBeGranted,
  findActiveOwnerIds,
  findRoleOrFail,
  isOwner,
} from "../roles/roles.service.js";
import type { Role } from "../roles/roles.table.js";
import { endAllSessionsForUser } from "../sessions/sessions.service.js";
import { findUserIdsWithTwoFactor } from "../two-factor/two-factor.service.js";
import { reassignAuthorship } from "./authorship.repository.js";
import {
  CannotChangeOwnAccountError,
  InvalidReassignmentError,
  LastOwnerError,
  OwnersOnlyError,
  UserNotFoundHttpError,
} from "./users.errors.js";
import { deleteUserRow, findUserById, listUserRows, updateUserRow } from "./users.repository.js";
import type { ListUsersQuery, UserListItem } from "./users.schema.js";
import type { User } from "./users.table.js";

/**
 * The Users screen's rules: listing people, changing roles, deactivating and removing.
 *
 * The rules that keep a site manageable:
 * - The last active owner can't be demoted, deactivated or removed.
 * - Only owners can change an owner, or make someone an owner.
 * - Nobody can give a role that allows more than they can do themselves.
 * - Nobody deactivates or removes their own account.
 */

/** The admin doing it: who they are and what they may do. */
export type Actor = Pick<SignedIn, "user" | "permissions">;

const AVATAR_WIDTH = 96;

export async function listUsers(
  database: DatabaseOrTransaction,
  query: ListUsersQuery,
  publicApiUrl: string,
): Promise<UserListItem[]> {
  const rows = await listUserRows(database, DEFAULT_TENANT_ID, query.search);
  return describeUsers(database, rows, publicApiUrl);
}

export async function getUser(
  database: DatabaseOrTransaction,
  userId: string,
  publicApiUrl: string,
): Promise<UserListItem> {
  const user = await findUserOrFail(database, userId);
  const [described] = await describeUsers(
    database,
    [{ ...user, lastSessionUsedAt: null }],
    publicApiUrl,
  );
  if (!described) {
    throw new UserNotFoundHttpError();
  }
  return described;
}

export interface RoleChangeResult {
  user: User;
  from: string[];
  to: Role;
}

export async function changeUserRole(
  database: DatabaseOrTransaction,
  actor: Actor,
  userId: string,
  roleId: string,
): Promise<RoleChangeResult> {
  return database.transaction(async (transaction) => {
    const user = await findUserOrFail(transaction, userId);
    const role = await findRoleOrFail(transaction, roleId);
    const currentRoles = await findRolesForUsers(transaction, [user.id]);

    await checkMayManage(transaction, actor, user);
    checkRoleCanBeGranted(role, actor.permissions);
    const losesOwner =
      currentRoles.some((current) => current.handle === OWNER_ROLE_HANDLE) &&
      role.handle !== OWNER_ROLE_HANDLE;
    if (losesOwner) {
      await checkNotLastOwner(transaction, user.id, "change their role");
    }

    await replaceRolesOfUser(transaction, user.id, role.id);
    return { user, from: currentRoles.map((current) => current.name), to: role };
  });
}

export async function deactivateUser(
  database: DatabaseOrTransaction,
  actor: Actor,
  userId: string,
  now = new Date(),
): Promise<User> {
  if (userId === actor.user.id) {
    throw new CannotChangeOwnAccountError("deactivate");
  }
  return database.transaction(async (transaction) => {
    const user = await findUserOrFail(transaction, userId);
    await checkMayManage(transaction, actor, user);
    if (user.status === "deactivated") {
      return user;
    }
    await checkNotLastOwner(transaction, user.id, "deactivate them");
    const updated = await updateUserRow(transaction, user.id, {
      status: "deactivated",
      deactivatedAt: now,
    });
    // Deactivating signs them out everywhere, straight away.
    await endAllSessionsForUser(transaction, user.id);
    return updated ?? user;
  });
}

export async function reactivateUser(
  database: DatabaseOrTransaction,
  actor: Actor,
  userId: string,
): Promise<User> {
  const user = await findUserOrFail(database, userId);
  await checkMayManage(database, actor, user);
  const updated = await updateUserRow(database, user.id, { status: "active", deactivatedAt: null });
  return updated ?? user;
}

export interface RemovedUser {
  user: User;
  reassignedTo: User;
  reassignedEntries: number;
}

/**
 * Removes someone's account after moving their content to another active person. Their
 * sessions, passkeys and API tokens go with the account.
 */
export async function removeUser(
  database: DatabaseOrTransaction,
  actor: Actor,
  userId: string,
  reassignToUserId: string,
): Promise<RemovedUser> {
  if (userId === actor.user.id) {
    throw new CannotChangeOwnAccountError("remove");
  }
  return database.transaction(async (transaction) => {
    const user = await findUserOrFail(transaction, userId);
    await checkMayManage(transaction, actor, user);
    await checkNotLastOwner(transaction, user.id, "remove them");

    const reassignTo = await findUserById(transaction, reassignToUserId);
    if (!reassignTo || reassignTo.id === user.id || reassignTo.status !== "active") {
      throw new InvalidReassignmentError();
    }

    const reassignedEntries = await reassignAuthorship(transaction, user.id, reassignTo.id);
    await deleteUserRow(transaction, user.id);
    return { user, reassignedTo: reassignTo, reassignedEntries };
  });
}

async function findUserOrFail(database: DatabaseOrTransaction, userId: string): Promise<User> {
  const user = await findUserById(database, userId);
  if (!user || user.tenantId !== DEFAULT_TENANT_ID) {
    throw new UserNotFoundHttpError();
  }
  return user;
}

/** Owners can only be changed by owners. */
async function checkMayManage(database: DatabaseOrTransaction, actor: Actor, user: User) {
  if ((await isOwner(database, user.id)) && !(await isOwner(database, actor.user.id))) {
    throw new OwnersOnlyError();
  }
}

async function checkNotLastOwner(database: DatabaseOrTransaction, userId: string, change: string) {
  const owners = await findActiveOwnerIds(database);
  if (owners.length === 1 && owners[0] === userId) {
    throw new LastOwnerError(change);
  }
}

async function describeUsers(
  database: DatabaseOrTransaction,
  rows: Array<User & { lastSessionUsedAt: Date | null }>,
  publicApiUrl: string,
): Promise<UserListItem[]> {
  const userIds = rows.map((row) => row.id);
  const roles = await findRolesForUsers(database, userIds);
  const withTwoFactor = new Set(await findUserIdsWithTwoFactor(database, userIds));
  const avatarIds = rows.flatMap((row) => (row.avatarAssetId ? [row.avatarAssetId] : []));
  const avatars = new Map(
    (await findAssetsByIdList(database, DEFAULT_TENANT_ID, avatarIds)).map((asset) => [
      asset.id,
      assetFileUrl(publicApiUrl, asset, {
        w: AVATAR_WIDTH,
        h: AVATAR_WIDTH,
        fit: "cover",
        format: "webp",
      }),
    ]),
  );

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    status: row.status,
    roles: roles
      .filter((role) => role.userId === row.id)
      .map((role) => ({ id: role.id, name: role.name, handle: role.handle })),
    avatarUrl: row.avatarAssetId ? (avatars.get(row.avatarAssetId) ?? null) : null,
    twoFactorEnabled: withTwoFactor.has(row.id),
    lastActiveAt: latest(row.lastSignedInAt, row.lastSessionUsedAt)?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

function latest(first: Date | null, second: Date | null): Date | null {
  if (!first || !second) {
    return first ?? second;
  }
  return first > second ? first : second;
}
