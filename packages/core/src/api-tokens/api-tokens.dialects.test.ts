import { expect, it } from "vitest";
import { addTestUser, describeOnEveryDatabase } from "../testing/every-database.js";
import {
  deleteApiTokenRow,
  findApiTokenByHash,
  insertApiToken,
  listApiTokenRows,
  recordApiTokenUse,
} from "./api-tokens.repository.js";

const TENANT = "default";

describeOnEveryDatabase("API tokens", (handle) => {
  it("saves a token, lists it with its maker, and records its use", async () => {
    const { database } = handle;
    const user = await addTestUser(database);
    const token = await insertApiToken(database, {
      name: "Website",
      access: "read",
      tokenHash: "hash",
      tokenStart: "abc",
      createdBy: user.id,
    });
    const usedAt = new Date("2026-11-04T10:00:00.125Z");
    await recordApiTokenUse(database, token.id, usedAt);

    expect((await findApiTokenByHash(database, "hash"))?.lastUsedAt).toEqual(usedAt);
    const listed = await listApiTokenRows(database, TENANT);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.name).toBe("Website");
  });

  it("deletes a token once", async () => {
    const { database } = handle;
    const user = await addTestUser(database);
    const token = await insertApiToken(database, {
      name: "Website",
      access: "read",
      tokenHash: "hash",
      tokenStart: "abc",
      createdBy: user.id,
    });
    expect(await deleteApiTokenRow(database, TENANT, token.id)).toEqual({
      id: token.id,
      name: "Website",
    });
    expect(await deleteApiTokenRow(database, TENANT, token.id)).toBeUndefined();
  });
});
