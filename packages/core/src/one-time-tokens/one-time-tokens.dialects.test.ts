import { expect, it } from "vitest";
import { addTestUser, describeOnEveryDatabase } from "../testing/every-database.js";
import {
  countRecentOneTimeTokens,
  deleteOneTimeTokensForUser,
  findLatestUnusedOneTimeTokenForUser,
  findUnusedOneTimeToken,
  insertOneTimeToken,
  markOneTimeTokenUsed,
} from "./one-time-tokens.repository.js";

const now = new Date("2026-11-04T10:00:00.000Z");
const later = new Date("2026-11-04T11:00:00.000Z");
const purpose = "password-reset";

describeOnEveryDatabase("One-time tokens", (handle) => {
  it("finds an unused token until it expires", async () => {
    const { database } = handle;
    const { id: userId } = await addTestUser(database);
    await insertOneTimeToken(database, { purpose, userId, tokenHash: "a", expiresAt: later });
    expect(await findUnusedOneTimeToken(database, purpose, "a", now)).toBeDefined();
    expect(await findUnusedOneTimeToken(database, purpose, "a", later)).toBeUndefined();
    const latest = await findLatestUnusedOneTimeTokenForUser(database, userId, purpose, now);
    expect(latest?.tokenHash).toBe("a");
  });

  it("lets only one of two requests racing with the same link use it", async () => {
    const { database } = handle;
    await insertOneTimeToken(database, { purpose, tokenHash: "a", expiresAt: later });
    const results = await Promise.all([
      markOneTimeTokenUsed(database, purpose, "a", now),
      markOneTimeTokenUsed(database, purpose, "a", now),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("counts recent tokens and clears them", async () => {
    const { database } = handle;
    const { id: userId } = await addTestUser(database);
    await insertOneTimeToken(database, { purpose, userId, tokenHash: "a", expiresAt: later });
    await insertOneTimeToken(database, { purpose, userId, tokenHash: "b", expiresAt: later });
    const since = new Date(Date.now() - 60_000);
    expect(await countRecentOneTimeTokens(database, userId, purpose, since)).toBe(2);
    await deleteOneTimeTokensForUser(database, userId, purpose);
    expect(await countRecentOneTimeTokens(database, userId, purpose, since)).toBe(0);
  });
});
