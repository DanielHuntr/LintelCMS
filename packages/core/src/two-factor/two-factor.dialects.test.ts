import { expect, it } from "vitest";
import { addTestUser, describeOnEveryDatabase } from "../testing/every-database.js";
import {
  claimTotpStep,
  countUnusedRecoveryCodes,
  deleteRecoveryCodes,
  deleteTwoFactorRow,
  findEnabledTwoFactorUserIds,
  findTwoFactorRow,
  replaceRecoveryCodes,
  savePendingSecret,
  updateTwoFactorRow,
  useRecoveryCode,
} from "./two-factor.repository.js";

describeOnEveryDatabase("Two-factor sign-in", (handle) => {
  it("saves a pending secret twice, then enables it", async () => {
    const { database } = handle;
    const { id } = await addTestUser(database);
    await savePendingSecret(database, id, "first");
    await savePendingSecret(database, id, "second");
    expect((await findTwoFactorRow(database, id))?.pendingSecret).toBe("second");
    expect(await findEnabledTwoFactorUserIds(database, [id])).toEqual([]);

    await updateTwoFactorRow(database, id, { secret: "second", enabledAt: new Date() });
    expect(await findEnabledTwoFactorUserIds(database, [id])).toEqual([id]);
    expect(await findEnabledTwoFactorUserIds(database, [])).toEqual([]);

    await deleteTwoFactorRow(database, id);
    expect(await findTwoFactorRow(database, id)).toBeUndefined();
  });

  it("claims a code's step only once, though the row's key isn't an id", async () => {
    const { database } = handle;
    const { id } = await addTestUser(database);
    await savePendingSecret(database, id, "secret");
    expect(await claimTotpStep(database, id, 5, null)).toBe(true);
    expect(await claimTotpStep(database, id, 5, null)).toBe(false);
    expect(await claimTotpStep(database, id, 6, 5)).toBe(true);
  });

  it("spends each recovery code once, and replaces the set", async () => {
    const { database } = handle;
    const { id } = await addTestUser(database);
    await replaceRecoveryCodes(database, id, ["a", "b"]);
    expect(await useRecoveryCode(database, id, "a", new Date())).toBe(true);
    expect(await useRecoveryCode(database, id, "a", new Date())).toBe(false);
    expect(await countUnusedRecoveryCodes(database, id)).toBe(1);
    await replaceRecoveryCodes(database, id, ["c", "d", "e"]);
    expect(await countUnusedRecoveryCodes(database, id)).toBe(3);
    await deleteRecoveryCodes(database, id);
    expect(await countUnusedRecoveryCodes(database, id)).toBe(0);
  });
});
