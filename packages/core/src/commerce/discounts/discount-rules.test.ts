import { describe, expect, it } from "vitest";
import { applyDiscounts, type PricedCartLine } from "../carts/cart-pricing.js";
import type { DiscountRequest } from "./discount-provider.js";
import {
  availabilityProblem,
  calculateDiscount,
  conditionsProblem,
  percentOf,
  type RequestLine,
} from "./discount-rules.js";
import { selectDiscounts } from "./discount-selection.js";
import type { DiscountRow } from "./discounts.table.js";

/** The discount rules that need no database: each is plain arithmetic over rows. */

const now = new Date("2026-08-01T10:00:00Z");

function discount(changes: Partial<DiscountRow> = {}): DiscountRow {
  return {
    id: "d-1",
    tenantId: "default",
    title: "Summer sale",
    method: "code",
    code: "SUMMER20",
    kind: "percentage",
    percentOff: 20,
    amounts: {},
    buyQuantity: 0,
    getQuantity: 0,
    scope: "order",
    productIds: [],
    collectionIds: [],
    minimumSpend: {},
    minimumQuantity: null,
    startsAt: new Date("2026-06-01T00:00:00Z"),
    endsAt: null,
    usageLimit: null,
    perCustomerLimit: null,
    combinesWithOthers: true,
    enabled: true,
    createdAt: now,
    updatedAt: now,
    ...changes,
  };
}

function line(lineId: string, unitAmount: number, quantity = 1, productId = "p-1"): RequestLine {
  return {
    lineId,
    variantId: `v-${lineId}`,
    productId,
    quantity,
    unitAmount,
    subtotalAmount: unitAmount * quantity,
  };
}

function request(lines: RequestLine[], codes: string[] = [], currency = "GBP"): DiscountRequest {
  return {
    currency,
    marketId: "m-1",
    codes,
    email: "ada@example.com",
    lines,
    subtotalAmount: lines.reduce((sum, item) => sum + item.subtotalAmount, 0),
  };
}

const noUse = { total: 0, byCustomer: 0 };

describe("rounding in minor units", () => {
  it("rounds a percentage half up, once, then shares it so the lines add up exactly", () => {
    expect(percentOf(1005, 10)).toBe(101); // 100.5p rounds up
    expect(percentOf(1004, 10)).toBe(100); // 100.4p rounds down

    // Three lines of 333p: 15% of 999p is 149.85p, so 150p, shared 50 / 50 / 50.
    const lines = [line("a", 333), line("b", 333), line("c", 333)];
    const off = calculateDiscount(discount({ percentOff: 15 }), lines, "GBP");
    expect(off.amount).toBe(150);
    expect(Object.values(off.lineAmounts ?? {})).toEqual([50, 50, 50]);

    // Uneven lines: 10% of 1001p is 100.1p, so 100p; the shares still total exactly 100.
    const uneven = calculateDiscount(
      discount({ percentOff: 10 }),
      [line("a", 667), line("b", 334)],
      "GBP",
    );
    expect(uneven.amount).toBe(100);
    expect(uneven.lineAmounts).toEqual({ a: 67, b: 33 });
  });

  it("works in currencies without minor units, such as yen", () => {
    const off = calculateDiscount(discount({ percentOff: 15 }), [line("a", 1999)], "JPY");
    expect(off.amount).toBe(300); // ¥299.85 rounds to ¥300
  });

  it("takes a fixed amount in the cart's currency, never more than the items cost", () => {
    const fixed = discount({ kind: "fixed_amount", amounts: { GBP: 1000, EUR: 1200 } });
    expect(calculateDiscount(fixed, [line("a", 4500)], "EUR").amount).toBe(1200);
    expect(calculateDiscount(fixed, [line("a", 600)], "GBP").amount).toBe(600);
    expect(conditionsProblem(fixed, [line("a", 4500)], "USD")).toBe(
      "This code can't be used when paying in USD.",
    );
  });

  it("gives the cheapest item of each group free for buy 2, get 1", () => {
    const offer = discount({
      kind: "buy_x_get_y",
      buyQuantity: 2,
      getQuantity: 1,
      percentOff: 100,
    });
    // Units, dearest first: 3000, 3000, 2000 | 2000, 1000 (an incomplete group pays in full).
    const off = calculateDiscount(
      offer,
      [line("shirt", 3000, 2), line("sock", 2000, 2), line("cap", 1000)],
      "GBP",
    );
    expect(off.lineAmounts).toEqual({ sock: 2000 });
    expect(off.amount).toBe(2000);

    const halfPrice = calculateDiscount({ ...offer, percentOff: 50 }, [line("a", 999, 3)], "GBP");
    expect(halfPrice.amount).toBe(500); // 499.5p rounds up
  });
});

describe("conditions", () => {
  it("explains dates, limits and the switch in words a shopper understands", () => {
    expect(
      availabilityProblem(discount({ endsAt: new Date("2026-07-31T23:00:00Z") }), noUse, now),
    ).toBe("This code has expired.");
    expect(
      availabilityProblem(discount({ startsAt: new Date("2026-09-01T00:00:00Z") }), noUse, now),
    ).toBe("This code can't be used until 1 September 2026.");
    expect(
      availabilityProblem(discount({ usageLimit: 10 }), { total: 10, byCustomer: 0 }, now),
    ).toBe("This code has reached its usage limit.");
    expect(
      availabilityProblem(discount({ perCustomerLimit: 1 }), { total: 3, byCustomer: 1 }, now),
    ).toBe("You've already used this code.");
    expect(availabilityProblem(discount({ enabled: false }), noUse, now)).toBe(
      "This code isn't available at the moment.",
    );
    expect(
      availabilityProblem(discount({ usageLimit: 10 }), { total: 9, byCustomer: 0 }, now),
    ).toBeNull();
  });

  it("counts only the items in scope towards the minimum spend and quantity", () => {
    const summer = discount({
      scope: "collections",
      collectionIds: ["summer"],
      minimumSpend: { GBP: 5000 },
    });
    const lines = [line("a", 3000, 1, "p-summer"), line("b", 4000, 1, "p-winter")];
    const membership = new Map([["p-summer", new Set(["summer"])]]);
    const selected = selectDiscounts(
      request(lines, ["summer20"]),
      {
        byCode: new Map([["SUMMER20", summer]]),
        automatic: [],
        usage: new Map(),
        collectionsByProduct: membership,
      },
      now,
    );
    expect(selected.discounts).toEqual([]);
    expect(selected.problems).toEqual([
      {
        code: "summer20",
        message: "Spend £50.00 or more on the items this code is for to use it.",
        blocking: false,
      },
    ]);

    const enough = selectDiscounts(
      request([line("a", 3000, 2, "p-summer"), line("b", 4000, 1, "p-winter")], ["SUMMER20"]),
      {
        byCode: new Map([["SUMMER20", summer]]),
        automatic: [],
        usage: new Map(),
        collectionsByProduct: membership,
      },
      now,
    );
    expect(enough.discounts[0]).toMatchObject({
      code: "SUMMER20",
      amount: 1200,
      lineAmounts: { a: 1200 },
    });
  });

  it("refuses unknown codes and a second code", () => {
    const selected = selectDiscounts(
      request([line("a", 1000)], ["NOPE", "ALSO"]),
      { byCode: new Map(), automatic: [], usage: new Map(), collectionsByProduct: new Map() },
      now,
    );
    expect(selected.problems).toEqual([
      { code: "ALSO", message: "Only one code can be used per order.", blocking: true },
      {
        code: "NOPE",
        message: "This code isn't valid. Check it's typed correctly.",
        blocking: true,
      },
    ]);
  });
});

describe("combining discounts", () => {
  const lines = [line("a", 10_000)];
  const candidates = (byCode: DiscountRow[], automatic: DiscountRow[]) => ({
    byCode: new Map(byCode.map((row) => [row.code ?? "", row])),
    automatic,
    usage: new Map(),
    collectionsByProduct: new Map(),
  });
  const code = discount({ id: "code", percentOff: 10 });
  const autoFive = discount({
    id: "auto5",
    method: "automatic",
    code: null,
    title: "5% off everything",
    percentOff: 5,
  });
  const autoFifteen = discount({
    id: "auto15",
    method: "automatic",
    code: null,
    title: "15% off",
    percentOff: 15,
  });
  const freeDelivery = discount({
    id: "ship",
    method: "automatic",
    code: null,
    title: "Free delivery",
    kind: "free_shipping",
  });

  it("adds one code to the best automatic discount and free shipping", () => {
    const selected = selectDiscounts(
      request(lines, ["SUMMER20"]),
      candidates([code], [autoFive, autoFifteen, freeDelivery]),
      now,
    );
    expect(
      selected.discounts.map((item) => [item.title, item.amount, item.freeShipping ?? false]),
    ).toEqual([
      ["Summer sale", 1000, false],
      ["15% off", 1500, false],
      ["Free delivery", 0, true],
    ]);
  });

  it("applies only the bigger saving when either can't be combined, and says why", () => {
    const exclusiveAuto = { ...autoFifteen, combinesWithOthers: false };
    const selected = selectDiscounts(
      request(lines, ["SUMMER20"]),
      candidates([code], [exclusiveAuto, freeDelivery]),
      now,
    );
    expect(selected.discounts.map((item) => item.title)).toEqual(["15% off"]);
    expect(selected.problems[0]?.message).toBe(
      "This code can't be combined with 15% off, which saves you more.",
    );

    const exclusiveCode = { ...code, percentOff: 30, combinesWithOthers: false };
    const codeWins = selectDiscounts(
      request(lines, ["SUMMER20"]),
      candidates([exclusiveCode], [autoFifteen]),
      now,
    );
    expect(codeWins.discounts.map((item) => item.amount)).toEqual([3000]);
    expect(codeWins.problems).toEqual([]);
  });

  it("puts line discounts where they belong and never takes a line below zero", () => {
    const priced = (id: string, amount: number): PricedCartLine => ({
      id,
      variantId: `v-${id}`,
      productId: "p",
      productTitle: id,
      productHandle: null,
      variantTitle: "",
      sku: null,
      imageId: null,
      quantity: 1,
      weightGrams: 0,
      unitPrice: { amount, currency: "GBP" },
      compareAtPrice: null,
      subtotal: { amount, currency: "GBP" },
      discountAmount: 0,
      quantityAvailable: null,
      problem: null,
    });
    const {
      lines: discounted,
      discountTotal,
      applied,
    } = applyDiscounts(
      [priced("a", 1000), priced("b", 3000)],
      [
        { code: "A", title: "Half off a", amount: 500, lineAmounts: { a: 500 } },
        { code: "", title: "£4 off", amount: 400 },
        { code: "", title: "Free delivery", amount: 0, freeShipping: true },
      ],
    );
    // £4 is shared over what's left of each line: 500 and 3000.
    expect(discounted.map((item) => item.discountAmount)).toEqual([557, 343]);
    expect(discountTotal).toBe(900);
    expect(applied.map((item) => item.amount)).toEqual([500, 400, 0]);
  });
});
