import { expect, it } from "vitest";
import { addTestUser, describeOnEveryDatabase } from "../../testing/every-database.js";
import {
  insertNotifications,
  listNotificationRows,
  markNotificationsRead,
} from "./notifications.repository.js";

const TENANT = "default";

describeOnEveryDatabase("Notifications", (handle) => {
  it("lists a person's notifications and marks them read", async () => {
    const { database } = handle;
    const { id: userId } = await addTestUser(database);
    await insertNotifications(database, []);
    await insertNotifications(database, [
      { userId, message: "First" },
      { userId, message: "Second" },
    ]);
    const { rows, unread } = await listNotificationRows(database, TENANT, userId, 10);
    expect(rows).toHaveLength(2);
    expect(unread).toBe(2);

    await markNotificationsRead(database, TENANT, userId, rows[0]?.id, new Date());
    expect((await listNotificationRows(database, TENANT, userId, 10)).unread).toBe(1);
    await markNotificationsRead(database, TENANT, userId, undefined, new Date());
    expect((await listNotificationRows(database, TENANT, userId, 10)).unread).toBe(0);
  });
});
