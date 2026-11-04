import { and, asc, eq, inArray, or, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import { sessionsTable as sessionsDefinition } from "../sessions/sessions.table.js";
import { type NewUser, type User, usersTable as usersDefinition } from "./users.table.js";
import { insertReturning, updateReturning } from "../database/dialect/writes.js";
import { tableFor } from "../database/dialect/mysql-tables.js";
import { likeIgnoringCase } from "../database/dialect/expressions.js";

/** Database reads and writes for users, nothing else. */

export async function findUserByEmail(
  database: DatabaseOrTransaction,
  tenantId: string,
  email: string,
): Promise<User | undefined> {
  const usersTable = tableFor(database, usersDefinition);
  const [user] = await database
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.tenantId, tenantId), eq(usersTable.email, email)))
    .limit(1);
  return user;
}

export async function findUserById(
  database: DatabaseOrTransaction,
  userId: string,
): Promise<User | undefined> {
  const usersTable = tableFor(database, usersDefinition);
  const [user] = await database.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return user;
}

/** The ids, of those given, that are people's accounts; for "People" fields. */
export async function findExistingUserIds(
  database: DatabaseOrTransaction,
  userIds: readonly string[],
): Promise<string[]> {
  const usersTable = tableFor(database, usersDefinition);
  if (userIds.length === 0) {
    return [];
  }
  const rows = await database
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(inArray(usersTable.id, [...userIds]));
  return rows.map((row) => row.id);
}

/** Names for "People" fields in the delivery API: never email addresses. */
export async function findUserNamesByIds(
  database: DatabaseOrTransaction,
  userIds: readonly string[],
): Promise<{ id: string; name: string }[]> {
  const usersTable = tableFor(database, usersDefinition);
  if (userIds.length === 0) {
    return [];
  }
  return database
    .select({ id: usersTable.id, name: usersTable.name })
    .from(usersTable)
    .where(inArray(usersTable.id, [...userIds]));
}

export async function insertUser(database: DatabaseOrTransaction, user: NewUser): Promise<User> {
  const usersTable = tableFor(database, usersDefinition);
  const [inserted] = await insertReturning(database, usersTable, user);
  if (!inserted) {
    throw new Error("The database did not return the new user.");
  }
  return inserted;
}

export async function recordSignIn(
  database: DatabaseOrTransaction,
  userId: string,
  now: Date,
): Promise<void> {
  const usersTable = tableFor(database, usersDefinition);
  await database.update(usersTable).set({ lastSignedInAt: now }).where(eq(usersTable.id, userId));
}

/** True as soon as one user exists; cheaper than counting them all. */
export async function hasAnyUsers(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<boolean> {
  const usersTable = tableFor(database, usersDefinition);
  const [user] = await database
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.tenantId, tenantId))
    .limit(1);
  return user !== undefined;
}

export async function listUserEmails(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<string[]> {
  const usersTable = tableFor(database, usersDefinition);
  const rows = await database
    .select({ email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.tenantId, tenantId));
  return rows.map((row) => row.email);
}

export async function updatePasswordHash(
  database: DatabaseOrTransaction,
  userId: string,
  passwordHash: string,
): Promise<void> {
  const usersTable = tableFor(database, usersDefinition);
  await database.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, userId));
}

export interface UserRowWithActivity extends User {
  lastSessionUsedAt: Date | null;
}

/** Everyone, newest first, with when each last used a session. */
export async function listUserRows(
  database: DatabaseOrTransaction,
  tenantId: string,
  search: string | undefined,
): Promise<UserRowWithActivity[]> {
  const sessionsTable = tableFor(database, sessionsDefinition);
  const usersTable = tableFor(database, usersDefinition);
  const pattern = search ? `%${search.replace(/[\\%_]/g, (match) => `\\${match}`)}%` : undefined;
  const rows = await database
    .select({
      user: usersTable,
      lastSessionUsedAt:
        sql<Date | null>`(select max(${sessionsTable.lastUsedAt}) from ${sessionsTable} where ${sessionsTable.userId} = ${usersTable.id})`.mapWith(
          sessionsTable.lastUsedAt,
        ),
    })
    .from(usersTable)
    .where(
      and(
        eq(usersTable.tenantId, tenantId),
        pattern
          ? or(
              likeIgnoringCase(database, usersTable.name, pattern),
              likeIgnoringCase(database, usersTable.email, pattern),
            )
          : undefined,
      ),
    )
    .orderBy(asc(usersTable.name));
  return rows.map((row) => ({ ...row.user, lastSessionUsedAt: row.lastSessionUsedAt }));
}

export async function updateUserRow(
  database: DatabaseOrTransaction,
  userId: string,
  changes: Partial<Pick<User, "name" | "email" | "status" | "deactivatedAt" | "avatarAssetId">>,
): Promise<User | undefined> {
  const usersTable = tableFor(database, usersDefinition);
  const [updated] = await updateReturning(database, usersTable, changes, eq(usersTable.id, userId));
  return updated;
}

export async function deleteUserRow(database: DatabaseOrTransaction, userId: string) {
  const usersTable = tableFor(database, usersDefinition);
  await database.delete(usersTable).where(eq(usersTable.id, userId));
}
