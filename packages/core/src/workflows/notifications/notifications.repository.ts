import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../database/client.js";
import {
  type UserNotificationRow,
  userNotificationsTable as userNotificationsDefinition,
} from "../workflows.table.js";
import { tableFor } from "../../database/dialect/mysql-tables.js";

/** Database reads and writes for in-app notifications, nothing else. */

export async function insertNotifications(
  database: DatabaseOrTransaction,
  notifications: (typeof userNotificationsDefinition.$inferInsert)[],
): Promise<void> {
  const userNotificationsTable = tableFor(database, userNotificationsDefinition);
  if (notifications.length > 0) {
    await database.insert(userNotificationsTable).values(notifications);
  }
}

export async function listNotificationRows(
  database: DatabaseOrTransaction,
  tenantId: string,
  userId: string,
  limit: number,
): Promise<{ rows: UserNotificationRow[]; unread: number }> {
  const userNotificationsTable = tableFor(database, userNotificationsDefinition);
  const mine = and(
    eq(userNotificationsTable.tenantId, tenantId),
    eq(userNotificationsTable.userId, userId),
  );
  const rows = await database
    .select()
    .from(userNotificationsTable)
    .where(mine)
    .orderBy(desc(userNotificationsTable.createdAt))
    .limit(limit);
  const [count] = await database
    .select({ unread: sql<number>`count(*)`.mapWith(Number) })
    .from(userNotificationsTable)
    .where(and(mine, isNull(userNotificationsTable.readAt)));
  return { rows, unread: count?.unread ?? 0 };
}

/** Marks one notification, or with no id all of them, as read. Only the person's own. */
export async function markNotificationsRead(
  database: DatabaseOrTransaction,
  tenantId: string,
  userId: string,
  notificationId: string | undefined,
  now: Date,
): Promise<void> {
  const userNotificationsTable = tableFor(database, userNotificationsDefinition);
  const conditions = [
    eq(userNotificationsTable.tenantId, tenantId),
    eq(userNotificationsTable.userId, userId),
    isNull(userNotificationsTable.readAt),
  ];
  if (notificationId) conditions.push(eq(userNotificationsTable.id, notificationId));
  await database
    .update(userNotificationsTable)
    .set({ readAt: now })
    .where(and(...conditions));
}
