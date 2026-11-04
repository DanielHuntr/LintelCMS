import { expect, it } from "vitest";
import { addTestUser, describeOnEveryDatabase } from "../testing/every-database.js";
import {
  deletePasskeyRow,
  findPasskeyByCredentialId,
  insertPasskey,
  listPasskeyRows,
  recordPasskeyUse,
} from "./passkeys.repository.js";

describeOnEveryDatabase("Passkeys", (handle) => {
  it("saves a passkey with its list of transports, and records its use", async () => {
    const { database } = handle;
    const { id: userId } = await addTestUser(database);
    const credentialId = "Ab-_".repeat(120);
    const passkey = await insertPasskey(database, {
      userId,
      name: "Phone",
      credentialId,
      publicKey: "key",
      transports: ["internal", "hybrid"],
    });
    expect(passkey.transports).toEqual(["internal", "hybrid"]);

    const usedAt = new Date("2026-11-04T10:00:00.500Z");
    await recordPasskeyUse(database, passkey.id, 7, usedAt);
    const found = await findPasskeyByCredentialId(database, credentialId);
    expect(found).toMatchObject({ counter: 7, lastUsedAt: usedAt });
    expect(await findPasskeyByCredentialId(database, credentialId.toLowerCase())).toBe(undefined);
    expect(await listPasskeyRows(database, userId)).toHaveLength(1);
  });

  it("deletes only the person's own passkey", async () => {
    const { database } = handle;
    const { id: userId } = await addTestUser(database);
    const other = await addTestUser(database, "other@example.com");
    const passkey = await insertPasskey(database, {
      userId,
      name: "Phone",
      credentialId: "a",
      publicKey: "key",
    });
    await deletePasskeyRow(database, other.id, passkey.id);
    expect(await listPasskeyRows(database, userId)).toHaveLength(1);
    await deletePasskeyRow(database, userId, passkey.id);
    expect(await listPasskeyRows(database, userId)).toEqual([]);
  });
});
