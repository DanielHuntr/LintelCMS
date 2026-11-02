import { describeShippingRate, type ShippingRate } from "@lintel/builder/site-shop-api";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { useTestDatabase } from "../../testing/test-database.js";
import { fillCart, startTestShop, stockTheShop, type TestShop } from "../testing/test-shop.js";
import { shippingRateOptionSchema } from "./storefront.openapi.js";

/**
 * The website's shop script (`@lintel/builder/site-shop-api`) reads the storefront API's
 * answers. These tests feed it the real answers, checked against the storefront's OpenAPI
 * schemas, so a renamed field breaks here (and in typecheck) rather than in a shopper's
 * basket (LINTEL-FUNC-002 in docs/qa/BUG-REPORT.md).
 */
describe("the website's shop script and the storefront API", () => {
  const testDatabase = useTestDatabase();
  let shop: TestShop;

  beforeEach(async () => {
    shop = await startTestShop(testDatabase.database, testDatabase.activeDatabase);
  });
  afterEach(() => shop.server.close());

  it("reads the delivery rates the API offers", async () => {
    const { variantId, rateId } = await stockTheShop(shop);
    const { token } = await fillCart(shop, variantId, rateId);

    const answer = await shop.storefront("GET", `/delivery/shop/carts/${token}/shipping-rates`);
    expect(answer.statusCode).toBe(200);
    const { rates } = z.object({ rates: z.array(shippingRateOptionSchema) }).parse(answer.json());
    // Typecheck fails here if the API's rate stops fitting the website's.
    const offered: ShippingRate[] = rates;

    expect(offered.map((rate) => rate.rateId)).toEqual([rateId]);
    // Outside a browser the price falls back to "4.95 GBP"; what matters is that it's read.
    expect(offered.map(describeShippingRate)).toEqual(["Standard, 4.95 GBP (2 to 3 working days)"]);
  });
});
