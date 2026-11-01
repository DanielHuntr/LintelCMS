import { describe, expect, it } from "vitest";
import { discountInputFromDraft, emptyDiscountDraft, suggestCode } from "./discountDraft.js";
import type { DiscountInput } from "./discounts.api.js";
import { summariseDiscount, type SummaryContext } from "./discountSummary.js";
import { groupProblems, redirectsCsv } from "./importReport.js";

const context: SummaryContext = {
  currency: "GBP",
  productNames: new Map([["p1", "Linen shirt"]]),
  collectionNames: new Map([["c1", "Summer Edit"]]),
  now: new Date("2026-06-01T10:00:00"),
};

const base: DiscountInput = {
  title: "Summer sale",
  method: "code",
  code: "SUMMER20",
  kind: "percentage",
  percentOff: 20,
  amounts: {},
  buyQuantity: 1,
  getQuantity: 1,
  scope: "collections",
  productIds: [],
  collectionIds: ["c1"],
  minimumSpend: { GBP: 5000 },
  minimumQuantity: null,
  startsAt: "2026-05-01T00:00:00",
  endsAt: "2026-08-31T23:59:59",
  usageLimit: null,
  perCustomerLimit: null,
  combinesWithOthers: true,
  enabled: true,
};

describe("a discount in one sentence", () => {
  it("says what it gives, what it's for, the minimum and the dates", () => {
    expect(summariseDiscount({ ...base, scope: "order", collectionIds: [] }, context)).toBe(
      "20% off everything, orders of £50 or more, until 31 Aug",
    );
    expect(summariseDiscount(base, context)).toBe(
      "20% off Summer Edit, when spending £50 or more on them, until 31 Aug",
    );
  });

  it("covers every kind, limits and starting later", () => {
    const later = { minimumSpend: {}, startsAt: "2026-07-01T00:00:00", endsAt: null };
    expect(
      summariseDiscount(
        {
          ...base,
          ...later,
          kind: "fixed_amount",
          amounts: { GBP: 1050 },
          scope: "products",
          productIds: ["p1"],
        },
        context,
      ),
    ).toBe("£10.50 off Linen shirt, from 1 Jul");
    expect(
      summariseDiscount(
        {
          ...base,
          kind: "free_shipping",
          scope: "order",
          minimumSpend: {},
          endsAt: null,
          perCustomerLimit: 1,
        },
        context,
      ),
    ).toBe("Free delivery, once per customer");
    expect(
      summariseDiscount(
        {
          ...base,
          kind: "buy_x_get_y",
          buyQuantity: 2,
          getQuantity: 1,
          percentOff: 100,
          minimumSpend: {},
          endsAt: "2027-01-31T23:59:59",
          usageLimit: 100,
        },
        context,
      ),
    ).toBe("Buy 2, get 1 free on Summer Edit, until 31 Jan 2027, first 100 uses");
  });
});

describe("the discount form", () => {
  it("turns what's typed into the API's shape, per currency", () => {
    const draft = {
      ...emptyDiscountDraft("2026-06-01"),
      title: " Ten off ",
      code: "ten-off",
      kind: "fixed_amount" as const,
      amountTexts: { GBP: "10", EUR: "12.50" },
      minimum: "spend" as const,
      minimumSpendTexts: { GBP: "50" },
      oncePerCustomer: true,
    };
    const { input, problems } = discountInputFromDraft(draft, ["GBP", "EUR"]);
    expect(problems).toEqual({});
    expect(input).toMatchObject({
      title: "Ten off",
      code: "TEN-OFF",
      amounts: { GBP: 1000, EUR: 1250 },
      minimumSpend: { GBP: 5000 },
      perCustomerLimit: 1,
      endsAt: null,
    });
  });

  it("says what needs fixing", () => {
    const draft = {
      ...emptyDiscountDraft("2026-06-01"),
      code: "x",
      percentText: "150",
      scope: "products" as const,
      endDate: "2026-05-01",
    };
    expect(discountInputFromDraft(draft, ["GBP"]).problems).toEqual({
      title: "titleRequired",
      code: "codeFormat",
      percentOff: "percent",
      productIds: "products",
      endsAt: "endBeforeStart",
    });
  });

  it("makes up codes without letters people mix up", () => {
    const code = suggestCode(() => 0.5);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  });
});

describe("the import report", () => {
  it("offers redirects as a spreadsheet and groups problems by item", () => {
    expect(redirectsCsv([{ fromPath: "/products/a", toPath: "/shop/a" }])).toBe(
      "from,to\n/products/a,/shop/a\n",
    );
    expect(
      groupProblems([
        { stage: "products", item: "linen-shirt", message: "A photo was skipped" },
        { stage: "products", item: "linen-shirt", message: "Another photo was skipped" },
        { stage: "customers", item: "No Email", message: "No email" },
      ]),
    ).toEqual([
      {
        item: "linen-shirt",
        stage: "products",
        messages: ["A photo was skipped", "Another photo was skipped"],
      },
      { item: "No Email", stage: "customers", messages: ["No email"] },
    ]);
  });
});
