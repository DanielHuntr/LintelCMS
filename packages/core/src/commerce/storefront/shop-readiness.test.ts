import { afterEach, describe, expect, it } from "vitest";
import { useTestDatabase } from "../../testing/test-database.js";
import { startTestShop, stockTheShop, type TestShop } from "../testing/test-shop.js";

// A shop without payments looked open: shoppers filled a basket and only checkout said no.
describe("a shop that can't take orders yet", () => {
  const testDatabase = useTestDatabase();
  let shop: TestShop | undefined;

  afterEach(() => shop?.server.close());

  it("shows its products as coming soon, with nothing to buy", async () => {
    shop = await startTestShop(testDatabase.database, testDatabase.activeDatabase, {
      environment: {},
    });
    await stockTheShop(shop);

    const listed = (await shop.storefront("GET", "/delivery/shop/products?country=GB")).json();

    expect(listed.items[0]).toMatchObject({ comingSoon: true, availableForSale: false });
    expect(
      listed.items[0].variants.every(
        (variant: { availableForSale: boolean }) => !variant.availableForSale,
      ),
    ).toBe(true);
  });

  it("opens once payments are connected and there's a delivery price", async () => {
    shop = await startTestShop(testDatabase.database, testDatabase.activeDatabase);
    await stockTheShop(shop);

    const product = (await shop.storefront("GET", "/delivery/shop/products/linen-shirt")).json();

    expect(product).toMatchObject({ comingSoon: false, availableForSale: true });
  });
});
