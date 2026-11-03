import { afterEach, describe, expect, it } from "vitest";
import { useTestDatabase } from "../../testing/test-database.js";
import { startTestShop, type TestShop } from "../testing/test-shop.js";

describe("shipping rates", () => {
  const testDatabase = useTestDatabase();
  let shop: TestShop | undefined;

  afterEach(() => shop?.server.close());

  async function newZone(): Promise<string> {
    shop = await startTestShop(testDatabase.database, testDatabase.activeDatabase);
    const zone = await shop.admin("POST", "/shop/shipping/zones", {
      name: "UK",
      countries: ["GB"],
    });
    return zone.json().id;
  }

  // LINTEL-FUNC-012: a rate with no price was saved, and checkout couldn't deliver to the zone.
  it("refuses a flat rate with no price", async () => {
    const zoneId = await newZone();
    const response = await shop!.admin("POST", `/shop/shipping/zones/${zoneId}/rates`, {
      name: "Standard",
      kind: "flat",
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().fields.amounts).toMatch(/price/);
  });

  it("refuses a weight rate with a step that has no price", async () => {
    const zoneId = await newZone();
    const response = await shop!.admin("POST", `/shop/shipping/zones/${zoneId}/rates`, {
      name: "By weight",
      kind: "weight",
      weightBrackets: [{ upToGrams: 1000, amounts: {} }],
    });
    expect(response.statusCode).toBe(400);
  });

  it("refuses taking the price off a saved rate", async () => {
    const zoneId = await newZone();
    const created = await shop!.admin("POST", `/shop/shipping/zones/${zoneId}/rates`, {
      name: "Standard",
      amounts: { GBP: 495 },
    });
    expect(created.statusCode).toBe(201);
    const rateId = created.json().rates[0].id;

    const emptied = await shop!.admin("PATCH", `/shop/shipping/rates/${rateId}`, { amounts: {} });
    expect(emptied.statusCode).toBe(400);
    const renamed = await shop!.admin("PATCH", `/shop/shipping/rates/${rateId}`, { name: "Post" });
    expect(renamed.statusCode).toBe(200);
  });

  // LINTEL-DATA-014: renaming a rate filled every other field with its default, wiping the price.
  it("keeps a rate's price, steps and estimate when only its name changes", async () => {
    const zoneId = await newZone();
    const created = await shop!.admin("POST", `/shop/shipping/zones/${zoneId}/rates`, {
      name: "Standard",
      amounts: { GBP: 495 },
      freeOverAmounts: { GBP: 5000 },
      deliveryEstimate: "2 to 3 days",
    });
    const rateId = created.json().rates[0].id;

    const renamed = await shop!.admin("PATCH", `/shop/shipping/rates/${rateId}`, { name: "Post" });

    expect(renamed.json().rates[0]).toMatchObject({
      name: "Post",
      amounts: { GBP: 495 },
      freeOverAmounts: { GBP: 5000 },
      deliveryEstimate: "2 to 3 days",
    });
  });
});
