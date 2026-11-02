import {
  type Cart as SiteCart,
  cartTotalRows,
  deliveryCountriesOf,
  describeShippingRate,
  type ShippingRate,
  type StorefrontMarket,
} from "@lintel/builder/site-shop-api";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { useTestDatabase } from "../../testing/test-database.js";
import { fillCart, startTestShop, stockTheShop, type TestShop } from "../testing/test-shop.js";
import { cartSchema } from "../carts/carts.schema.js";
import { shippingRateOptionSchema } from "./storefront.openapi.js";
import { storefrontMarketSchema } from "./storefront.schema.js";

/**
 * The website's shop script (`@lintel/builder/site-shop-api`) reads the storefront API's
 * answers. These tests feed it the real answers, checked against the storefront's OpenAPI
 * schemas, so a renamed field breaks here (and in typecheck) rather than in a shopper's
 * basket (LINTEL-FUNC-002, LINTEL-FUNC-003 and LINTEL-UX-003 in docs/qa/BUG-REPORT.md).
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

  /** Two shirts with an address and delivery chosen, and `code` typed in. */
  async function cartWithCode(discount: Record<string, unknown>): Promise<SiteCart> {
    const created = await shop.admin("POST", "/shop/discounts", { method: "code", ...discount });
    expect(created.statusCode, created.body).toBe(201);
    const { variantId, rateId } = await stockTheShop(shop);
    const { token } = await fillCart(shop, variantId, rateId, 2);
    const answer = await shop.storefront("PATCH", `/delivery/shop/carts/${token}`, {
      discountCodes: [discount.code],
    });
    expect(answer.statusCode, answer.body).toBe(200);
    // Typecheck fails here if the API's cart stops fitting the website's.
    const cart: SiteCart = cartSchema.parse(answer.json());
    return cart;
  }

  function addsUp(cart: SiteCart) {
    const rows = cartTotalRows(cart);
    const total = rows.at(-1);
    const sum = rows.slice(0, -1).reduce((value, row) => value + (row.amount?.amount ?? 0), 0);
    expect(total?.label).toBe("Total");
    expect(sum).toBe(total?.amount?.amount);
    return rows.map((row) => `${row.label} ${row.amount?.amount ?? "free"}`);
  }

  it("shows each discount as a line, adding up to the API's total", async () => {
    const cart = await cartWithCode({
      title: "Ten off",
      code: "SAVE10",
      kind: "percentage",
      percentOff: 10,
    });

    expect(addsUp(cart)).toEqual([
      "Subtotal 9000",
      "Discount (SAVE10) -900",
      "Delivery 495",
      "Total 8595",
    ]);
  });

  it("shows free delivery at full price with the saving as its own line", async () => {
    const cart = await cartWithCode({
      title: "Free delivery",
      code: "FREESHIP",
      kind: "free_shipping",
    });

    expect(addsUp(cart)).toEqual([
      "Subtotal 9000",
      "Delivery 495",
      "Free delivery (FREESHIP) -495",
      "Total 9000",
    ]);
  });

  it("offers only the countries a shipping zone delivers to", async () => {
    await stockTheShop(shop);
    // Ireland is sold to, but no shipping zone covers it yet.
    const ireland = await shop.admin("POST", "/shop/markets", {
      name: "Ireland",
      currency: "EUR",
      countries: ["IE"],
      pricesIncludeTax: true,
    });
    expect(ireland.statusCode, ireland.body).toBe(201);

    const answer = await shop.storefront("GET", "/delivery/shop/markets");
    const { markets } = z.object({ markets: z.array(storefrontMarketSchema) }).parse(answer.json());
    // Typecheck fails here if the API's market stops fitting the website's.
    const offered: StorefrontMarket[] = markets;

    expect(offered.map((market) => [market.countries, market.deliveryCountries])).toEqual([
      [["GB"], ["GB"]],
      [["IE"], []],
    ]);
    expect(deliveryCountriesOf({ markets: offered })).toEqual(["GB"]);
  });
});
