import type { DatabaseOrTransaction } from "../../database/client.js";
import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import type { Person } from "../workflow-people.repository.js";
import type { NotificationList } from "../workflows.schema.js";
import {
  insertNotifications,
  listNotificationRows,
  markNotificationsRead,
} from "./notifications.repository.js";

/**
 * Messages for people in the admin: "Ana asked you to review “About us”". Workflows send
 * them with a "Notify people" step, and approval steps tell the people who can answer.
 */
export async function notifyPeople(
  database: DatabaseOrTransaction,
  people: readonly Person[],
  notification: { message: string; link: string | null },
): Promise<void> {
  const userIds = [...new Set(people.map((person) => person.id))];
  await insertNotifications(
    database,
    userIds.map((userId) => ({
      tenantId: DEFAULT_TENANT_ID,
      userId,
      message: notification.message.slice(0, 1000),
      link: notification.link,
    })),
  );
}

export async function listNotifications(
  database: DatabaseOrTransaction,
  userId: string,
): Promise<NotificationList> {
  const { rows, unread } = await listNotificationRows(database, DEFAULT_TENANT_ID, userId, 50);
  return {
    unread,
    notifications: rows.map((row) => ({
      id: row.id,
      message: row.message,
      link: row.link,
      read: row.readAt !== null,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

/** Marks one of the person's notifications read, or all of them without an id. */
export async function markRead(
  database: DatabaseOrTransaction,
  userId: string,
  notificationId?: string,
  now = new Date(),
): Promise<void> {
  await markNotificationsRead(database, DEFAULT_TENANT_ID, userId, notificationId, now);
}
