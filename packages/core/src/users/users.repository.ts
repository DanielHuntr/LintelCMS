import { and, eq } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
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
