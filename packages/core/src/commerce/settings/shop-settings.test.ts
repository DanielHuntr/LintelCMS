import { afterEach, describe, expect, it } from "vitest";
import { useTestDatabase } from "../../testing/test-database.js";
import { startTestShop, type TestShop } from "../testing/test-shop.js";

describe("shop settings", () => {
  const testDatabase = useTestDatabase();
  let shop: TestShop | undefined;

  afterEach(() => shop?.server.close());

  // LINTEL-FUNC-010: a save with nothing in it answered with a server error.
  it("answers a save with nothing to change with the settings as they are", async () => {
    shop = await startTestShop(testDatabase.database, testDatabase.activeDatabase);
    const before = (await shop.admin("GET", "/shop/settings")).json();

    const saved = await shop.admin("PATCH", "/shop/settings", {});

    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toEqual(before);
  });
});
