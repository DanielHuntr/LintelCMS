import { expect, it } from "vitest";
import { describeOnEveryDatabase } from "../testing/every-database.js";
import {
  deleteSettingValue,
  findSettingUpdatedAt,
  findSettingValue,
  insertSettingValueIfMissing,
  upsertSettingValue,
} from "./settings.repository.js";

const TENANT = "default";

describeOnEveryDatabase("Settings", (handle) => {
  it.each([
    ["an object", { a: 1, nested: { b: [true, null] } }],
    ["a list", ["one", "two"]],
    ["a word", "plain text"],
    ["a number", 42],
    ["true", true],
  ])("keeps %s exactly", async (_name, value) => {
    await upsertSettingValue(handle.database, TENANT, "key", value);
    expect(await findSettingValue(handle.database, TENANT, "key")).toEqual(value);
  });

  it("keeps text that looks like a number as text", async () => {
    await upsertSettingValue(handle.database, TENANT, "key", "123");
    const value = await findSettingValue(handle.database, TENANT, "key");
    // The built-in database's driver reads this back as the number 123, as it always has.
    expect(value).toBe(handle.name === "built-in" ? 123 : "123");
  });

  it("changes a saved value rather than adding a second", async () => {
    const { database } = handle;
    await upsertSettingValue(database, TENANT, "key", "first");
    await upsertSettingValue(database, TENANT, "key", "second");
    expect(await findSettingValue(database, TENANT, "key")).toBe("second");
    expect(await findSettingUpdatedAt(database, TENANT, "key")).toBeInstanceOf(Date);
  });

  it("saves only if there is nothing yet, and says which happened", async () => {
    const { database } = handle;
    expect(await insertSettingValueIfMissing(database, TENANT, "key", "first")).toBe(true);
    expect(await insertSettingValueIfMissing(database, TENANT, "key", "second")).toBe(false);
    expect(await findSettingValue(database, TENANT, "key")).toBe("first");
  });

  it("reads a deleted value as never saved", async () => {
    const { database } = handle;
    await upsertSettingValue(database, TENANT, "key", "first");
    await deleteSettingValue(database, TENANT, "key");
    expect(await findSettingValue(database, TENANT, "key")).toBeUndefined();
    expect(await findSettingUpdatedAt(database, TENANT, "key")).toBeNull();
  });
});
