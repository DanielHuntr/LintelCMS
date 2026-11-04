import { expect, it } from "vitest";
import { describeOnEveryDatabase } from "../../testing/every-database.js";
import {
  findOrCreateShopSettingsRow,
  takeNextOrderNumber,
  updateShopSettingsRow,
} from "./shop-settings.repository.js";

const TENANT = "default";

describeOnEveryDatabase("Shop settings", (handle) => {
  it("makes the row the first time, and changes it after", async () => {
    const { database } = handle;
    const created = await findOrCreateShopSettingsRow(database, TENANT);
    expect(created.nextOrderNumber).toBe(1001);
    await updateShopSettingsRow(database, TENANT, { shopName: "Corner Shop" });
    expect((await findOrCreateShopSettingsRow(database, TENANT)).shopName).toBe("Corner Shop");
  });

  it("never gives two orders the same number", async () => {
    const { database } = handle;
    await findOrCreateShopSettingsRow(database, TENANT);
    const taken = await Promise.all(
      Array.from({ length: 8 }, () => takeNextOrderNumber(database, TENANT)),
    );
    const numbers = taken.map((order) => order.number).sort((a, b) => a - b);
    expect(numbers).toEqual([1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008]);
    expect(taken[0]?.prefix).toBe("#");
  });
});
