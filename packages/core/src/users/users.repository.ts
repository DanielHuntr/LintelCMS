import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import { sessionsTable } from "../sessions/sessions.table.js";
import { type NewUser, type User, usersTable } from "./users.table.js";

/** Database reads and writes for users, nothing else. */

export async function findUserByEmail(
  database: DatabaseOrTransaction,
  tenantId: string,
  email: string,
): Promise<User | undefined> {
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
  const [user] = await database.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  return user;
}

export async function insertUser(database: DatabaseOrTransaction, user: NewUser): Promise<User> {
  const [inserted] = await database.insert(usersTable).values(user).returning();
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
  await database.update(usersTable).set({ lastSignedInAt: now }).where(eq(usersTable.id, userId));
}

/** True as soon as one user exists; cheaper than counting them all. */
export async function hasAnyUsers(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<boolean> {
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
  const pattern = search ? `%${search.replace(/[\\%_]/g, (match) => `\\${match}`)}%` : undefined;
  const rows = await database
    .select({
      user: usersTable,
      lastSessionUsedAt:
        sql<Date | null>`(select max(${sessionsTable.lastUsedAt}) from ${sessionsTable} where ${sessionsTable.userId} = ${usersTable.id})`.mapWith(
          (value: string | Date | null) => (value === null ? null : new Date(value)),
        ),
    })
    .from(usersTable)
    .where(
      and(
        eq(usersTable.tenantId, tenantId),
        pattern ? or(ilike(usersTable.name, pattern), ilike(usersTable.email, pattern)) : undefined,
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
  const [updated] = await database
    .update(usersTable)
    .set(changes)
    .where(eq(usersTable.id, userId))
    .returning();
  return updated;
}

export async function deleteUserRow(database: DatabaseOrTransaction, userId: string) {
  await database.delete(usersTable).where(eq(usersTable.id, userId));
}
