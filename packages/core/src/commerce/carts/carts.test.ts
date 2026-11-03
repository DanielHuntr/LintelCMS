import { afterEach, describe, expect, it } from "vitest";
import { useTestDatabase } from "../../testing/test-database.js";
import { fillCart, startTestShop, stockTheShop, type TestShop } from "../testing/test-shop.js";

describe("carts", () => {
  const testDatabase = useTestDatabase();
  let shop: TestShop | undefined;

  afterEach(() => shop?.server.close());

  // LINTEL-FUNC-019: a country on its own moved a cart with a UK address to US prices.
  it("keeps the delivery address's market when only a different country is sent", async () => {
    shop = await startTestShop(testDatabase.database, testDatabase.activeDatabase);
    const { variantId, rateId } = await stockTheShop(shop);
    await shop.admin("POST", "/shop/markets", {
      name: "United States",
      currency: "USD",
      countries: ["US"],
      pricesIncludeTax: false,
    });
    const { token } = await fillCart(shop, variantId, rateId);

    const switched = await shop.storefront("PATCH", `/delivery/shop/carts/${token}`, {
      country: "US",
    });
    expect(switched.statusCode).toBe(400);
    expect(switched.json().fields.country).toMatch(/delivery address/);

    const same = await shop.storefront("PATCH", `/delivery/shop/carts/${token}`, { country: "GB" });
    expect(same.statusCode).toBe(200);
    expect(same.json().market.currency).toBe("GBP");

    const moved = await shop.storefront("PATCH", `/delivery/shop/carts/${token}`, {
      shippingAddress: { ...(await addressOf(shop, token)), country: "US" },
    });
    expect(moved.json().market.currency).toBe("USD");
  });
});

async function addressOf(shop: TestShop, token: string) {
  return (await shop.storefront("GET", `/delivery/shop/carts/${token}`)).json().shippingAddress;
}
