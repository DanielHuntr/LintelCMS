import { describe, expect, it } from "vitest";
import { applyDiscounts, type PricedCartLine } from "./carts/cart-pricing.js";
import type { MarketRow } from "./markets/markets.table.js";
import { priceInMarket } from "./markets/market-prices.js";
import { fulfilmentStatusFor, paymentStatusFor } from "./orders/order-statuses.js";
import type { OrderLineRow } from "./orders/orders.table.js";
import { encodeStripeParameters } from "./payments/stripe-client.js";
import { computeStripeSignature, verifyStripeSignature } from "./payments/stripe-signature.js";
import { quoteShipping } from "./shipping/shipping-quotes.js";
import type { ShippingRateRow, ShippingZoneRow } from "./shipping/shipping.table.js";
import { ManualTaxProvider } from "./taxes/manual-tax-provider.js";

/** The shop's rules that need no database: each is plain arithmetic over rows. */

const now = new Date("2026-11-01T10:00:00Z");

const europe: MarketRow = {
  id: "m-eu",
  tenantId: "default",
  name: "Europe",
  handle: "europe",
  currency: "EUR",
  countries: ["DE", "FR"],
  isPrimary: false,
  exchangeRate: 1.17,
  priceRounding: "ninety_nine",
  pricesIncludeTax: true,
  paymentProvider: null,
  position: 1,
  createdAt: now,
  updatedAt: now,
};

describe("prices in a market", () => {
  it("uses a price set for the currency, or converts and rounds the primary one", () => {
    const prices = [{ currency: "GBP", amount: 4500, compareAtAmount: 6000 }];
    expect(priceInMarket(prices, europe, "GBP")).toEqual({
      price: { amount: 5299, currency: "EUR" },
      compareAtPrice: { amount: 7099, currency: "EUR" },
    });
    const withEuros = [...prices, { currency: "EUR", amount: 4900, compareAtAmount: null }];
    expect(priceInMarket(withEuros, europe, "GBP")?.price).toEqual({
      amount: 4900,
      currency: "EUR",
    });
    expect(priceInMarket([], europe, "GBP")).toBeNull();
  });
});

describe("shipping quotes", () => {
  const zone: ShippingZoneRow = {
    id: "z1",
    tenantId: "default",
    name: "Europe",
    countries: ["DE"],
    position: 0,
    createdAt: now,
    updatedAt: now,
  };
  const rate = (overrides: Partial<ShippingRateRow>): ShippingRateRow => ({
    id: "r1",
    tenantId: "default",
    zoneId: "z1",
    name: "Standard",
    kind: "flat",
    amounts: { EUR: 700 },
    weightBrackets: [],
    freeOverAmounts: null,
    deliveryEstimate: "",
    position: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  });
  const parcel = (weightGrams: number, subtotal: number) => ({
    country: "DE",
    weightGrams,
    subtotal: { amount: subtotal, currency: "EUR" },
  });

  it("charges flat, by weight, and nothing over the free threshold", () => {
    const rates = [
      rate({ id: "flat", freeOverAmounts: { EUR: 5000 } }),
      rate({
        id: "weight",
        kind: "weight",
        weightBrackets: [
          { upToGrams: 1000, amounts: { EUR: 500 } },
          { upToGrams: 5000, amounts: { EUR: 1200 } },
        ],
      }),
    ];
    const light = quoteShipping([zone], rates, parcel(800, 2000), europe, "GBP");
    expect(light.map((quote) => [quote.rateId, quote.amount.amount])).toEqual([
      ["flat", 700],
      ["weight", 500],
    ]);
    const heavyAndBig = quoteShipping([zone], rates, parcel(6000, 6000), europe, "GBP");
    // Over the last weight step, the weight rate isn't offered; the flat one is free.
    expect(heavyAndBig.map((quote) => [quote.rateId, quote.amount.amount])).toEqual([["flat", 0]]);
    expect(
      quoteShipping([zone], rates, { ...parcel(100, 100), country: "US" }, europe, "GBP"),
    ).toEqual([]);
  });

  it("converts a rate priced only in the primary currency", () => {
    const quotes = quoteShipping(
      [zone],
      [rate({ amounts: { GBP: 500 } })],
      parcel(1, 1),
      europe,
      "GBP",
    );
    expect(quotes[0]?.amount).toEqual({ amount: 599, currency: "EUR" });
  });
});

describe("manual tax", () => {
  const address = {
    name: "A",
    company: "",
    line1: "1 Street",
    line2: "",
    city: "Berlin",
    region: "",
    postalCode: "10115",
    country: "DE",
    phone: "",
  };

  it("takes tax out of included prices, or adds it on top, by country", async () => {
    const provider = new ManualTaxProvider([{ country: "DE", rate: 19, name: "MwSt" }], true);
    const included = await provider.calculateTax({
      currency: "EUR",
      taxesIncluded: true,
      address,
      lines: [{ reference: "v1", amount: 11900, quantity: 1 }],
      shippingAmount: 0,
      idempotencyKey: "k",
    });
    expect(included.lineTaxes.get("v1")).toBe(1900);
    const added = await provider.calculateTax({
      currency: "EUR",
      taxesIncluded: false,
      address,
      lines: [{ reference: "v1", amount: 10000, quantity: 1 }],
      shippingAmount: 500,
      idempotencyKey: "k",
    });
    expect([added.lineTaxes.get("v1"), added.shippingTax, added.totalTax]).toEqual([
      1900, 95, 1995,
    ]);
    const elsewhere = await provider.calculateTax({
      currency: "EUR",
      taxesIncluded: false,
      address: { ...address, country: "US" },
      lines: [{ reference: "v1", amount: 10000, quantity: 1 }],
      shippingAmount: 500,
      idempotencyKey: "k",
    });
    expect(elsewhere.totalTax).toBe(0);
  });
});

describe("discounts", () => {
  const line = (
    id: string,
    amount: number,
    problem: PricedCartLine["problem"] = null,
  ): PricedCartLine => ({
    id,
    variantId: id,
    productId: "p",
    productTitle: "Shirt",
    productHandle: "shirt",
    variantTitle: "Default",
    sku: null,
    imageId: null,
    quantity: 1,
    weightGrams: 0,
    unitPrice: { amount, currency: "GBP" },
    compareAtPrice: null,
    subtotal: { amount, currency: "GBP" },
    discountAmount: 0,
    quantityAvailable: null,
    problem,
  });

  it("spreads a discount over the lines that can be bought, never more than they cost", () => {
    const { lines, discountTotal } = applyDiscounts(
      [line("a", 3000), line("b", 1000), line("c", 500, "unavailable")],
      [{ code: "TEN", title: "£10 off", amount: 1000 }],
    );
    expect(lines.map((item) => item.discountAmount)).toEqual([750, 250, 0]);
    expect(discountTotal).toBe(1000);
    const capped = applyDiscounts([line("a", 300)], [{ code: "BIG", title: "Big", amount: 5000 }]);
    expect(capped.discountTotal).toBe(300);
  });
});

describe("order statuses", () => {
  const orderLine = (quantity: number, fulfilledQuantity: number, refundedQuantity: number) =>
    ({ quantity, fulfilledQuantity, refundedQuantity }) as OrderLineRow;

  it("follow the money refunded and the items sent", () => {
    expect(paymentStatusFor(1000, 0)).toBe("paid");
    expect(paymentStatusFor(1000, 400)).toBe("partially_refunded");
    expect(paymentStatusFor(1000, 1000)).toBe("refunded");
    expect(fulfilmentStatusFor([orderLine(2, 0, 0)])).toBe("unfulfilled");
    expect(fulfilmentStatusFor([orderLine(2, 1, 0)])).toBe("partially_fulfilled");
    expect(fulfilmentStatusFor([orderLine(2, 1, 1)])).toBe("fulfilled");
  });
});

describe("talking to Stripe", () => {
  it("encodes nested parameters the way Stripe reads them", () => {
    const form = encodeStripeParameters({
      line_items: [{ quantity: 2, price_data: { unit_amount: 4500 } }],
      discounts: undefined,
      metadata: { lintel_checkout_id: "c1" },
    });
    expect(form.toString()).toBe(
      "line_items%5B0%5D%5Bquantity%5D=2&line_items%5B0%5D%5Bprice_data%5D%5Bunit_amount%5D=4500&metadata%5Blintel_checkout_id%5D=c1",
    );
  });

  it("accepts only fresh webhooks signed with the signing secret", () => {
    const body = '{"id":"evt_1"}';
    const timestamp = Math.floor(now.getTime() / 1000);
    const valid = `t=${timestamp},v1=${computeStripeSignature(body, timestamp, "whsec_a")}`;
    expect(verifyStripeSignature(body, valid, "whsec_a", now)).toBe(true);
    expect(verifyStripeSignature(`${body} `, valid, "whsec_a", now)).toBe(false);
    expect(verifyStripeSignature(body, valid, "whsec_b", now)).toBe(false);
    expect(verifyStripeSignature(body, valid, "whsec_a", new Date(now.getTime() + 600_000))).toBe(
      false,
    );
    expect(
      verifyStripeSignature(body, `t=${timestamp},v1=00,${valid.split(",")[1]}`, "whsec_a", now),
    ).toBe(true);
  });
});
