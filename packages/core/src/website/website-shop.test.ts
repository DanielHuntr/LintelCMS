import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DELIVERY_ADDRESS,
  startTestShop,
  stockTheShop,
  type TestShop,
} from "../commerce/testing/test-shop.js";
import { useTestDatabase } from "../testing/test-database.js";
import { buildSiteServer, type SiteServer } from "./site-server.js";

/**
 * The website's shop elements against the real online shop (src/commerce), not samples:
 * the product grid lists what's in stock, and a shopper's basket reaches Stripe's hosted
 * checkout through the website's own /_lintel/api.
 */
describe("the shop on the built-in website", () => {
  const testDatabase = useTestDatabase();
  let shop: TestShop;
  let website: SiteServer;

  beforeEach(async () => {
    shop = await startTestShop(testDatabase.database, testDatabase.activeDatabase);
    website = buildSiteServer({ api: shop.server });
    await website.ready();
  });

  afterEach(async () => {
    await website.close();
    await shop.server.close();
  });

  const onWebsite = (method: "GET" | "POST" | "PATCH", url: string, payload?: object) =>
    website.inject({ method, url, ...(payload ? { payload } : {}) });

  it("lists the shop's real products, and takes a basket to the hosted checkout", async () => {
    const { variantId, rateId } = await stockTheShop(shop);

    const grid = await onWebsite("GET", "/shop");
    expect(grid.statusCode).toBe(200);
    expect(grid.body).toContain("Linen shirt");
    expect(grid.body).toContain("£45.00");
    const product = await onWebsite("GET", "/products/linen-shirt");
    expect(product.statusCode).toBe(200);
    expect(product.body).toContain(variantId);

    const created = await onWebsite("POST", "/_lintel/api/shop/carts", { country: "GB" });
    expect(created.statusCode, created.body).toBe(201);
    const { token } = created.json() as { token: string };
    const added = await onWebsite("POST", `/_lintel/api/shop/carts/${token}/lines`, {
      variantId,
      quantity: 1,
    });
    expect(added.statusCode, added.body).toBeLessThan(300);
    await onWebsite("PATCH", `/_lintel/api/shop/carts/${token}`, {
      email: "ada@example.com",
      shippingAddress: DELIVERY_ADDRESS,
      shippingRateId: rateId,
    });
    const checkout = await onWebsite("POST", `/_lintel/api/shop/carts/${token}/checkout`, {
      successUrl: "http://localhost:3000/order-confirmation",
      cancelUrl: "http://localhost:3000/cart",
    });
    expect(checkout.statusCode, checkout.body).toBe(201);
    expect(checkout.json()).toMatchObject({ mode: "hosted" });
    expect(checkout.json().url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
  });
});
