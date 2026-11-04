import { expect, it } from "vitest";
import { addTestUser, describeOnEveryDatabase } from "../testing/every-database.js";
import {
  deleteOtherSessionsOfUser,
  deleteSessionById,
  deleteSessionByTokenHash,
  deleteSessionOfUser,
  deleteSessionsForUser,
  findSessionByTokenHash,
  insertSession,
  listSessionsForUser,
  updateSessionExpiry,
} from "./sessions.repository.js";

const later = new Date("2030-01-02T03:04:05.678Z");

describeOnEveryDatabase("Sessions", (handle) => {
  it("saves and finds a session, and moves its expiry", async () => {
    const { database } = handle;
    const { id: userId } = await addTestUser(database);
    const session = await insertSession(database, { userId, tokenHash: "a", expiresAt: later });
    expect(session.expiresAt).toEqual(later);

    const newExpiry = new Date("2031-01-01T00:00:00.000Z");
    await updateSessionExpiry(database, session.id, {
      lastUsedAt: new Date(),
      expiresAt: newExpiry,
    });
    expect((await findSessionByTokenHash(database, "a"))?.expiresAt).toEqual(newExpiry);
    expect(await findSessionByTokenHash(database, "A")).toBeUndefined();
  });

  it("removes sessions one at a time, and says how many went", async () => {
    const { database } = handle;
    const { id: userId } = await addTestUser(database);
    const add = (tokenHash: string) =>
      insertSession(database, { userId, tokenHash, expiresAt: later });
    const first = await add("a");
    await add("b");
    await add("c");
    await add("d");
    const fifth = await add("e");
    await deleteSessionById(database, fifth.id);

    expect(await deleteSessionOfUser(database, userId, first.id)).toBe(true);
    expect(await deleteSessionOfUser(database, userId, first.id)).toBe(false);
    await deleteSessionByTokenHash(database, "b");
    expect(await listSessionsForUser(database, userId)).toHaveLength(2);
    expect(await deleteOtherSessionsOfUser(database, userId, "c")).toBe(1);
    expect(await deleteSessionsForUser(database, userId)).toBe(1);
  });
});
