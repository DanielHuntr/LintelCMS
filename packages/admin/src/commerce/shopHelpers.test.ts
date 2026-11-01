import { describe, expect, it } from "vitest";
import { formatMoney, inputToMinor, minorToInput } from "./money.js";
import { emptyProductDraft, productInputFromDraft } from "./productDraft.js";

describe("money in the admin", () => {
  it("shows minor units with each currency's own decimal places", () => {
    expect(formatMoney({ amount: 4500, currency: "GBP" })).toBe("£45.00");
    expect(formatMoney({ amount: 4500, currency: "JPY" })).toBe("¥4,500");
    expect(minorToInput(1299, "EUR")).toBe("12.99");
  });

  it("reads typed prices, and refuses ones that aren't", () => {
    expect(inputToMinor("45", "GBP")).toBe(4500);
    expect(inputToMinor("£1,299.5", "GBP")).toBe(129_950);
    expect(inputToMinor("4500", "JPY")).toBe(4500);
    expect(inputToMinor("12.345", "GBP")).toBeNull();
    expect(inputToMinor("free", "GBP")).toBeNull();
  });
});

describe("turning the product form into what the API needs", () => {
  it("prices the variant in the shop's currency and stocks each location", () => {
    const draft = emptyProductDraft();
    draft.title = "Linen shirt";
    const [variant] = draft.variants;
    if (!variant) throw new Error("A new product starts with one variant");
    variant.price = "45";
    variant.stock = { warehouse: "12" };

    const { input, problems } = productInputFromDraft(draft, "GBP", ["warehouse"]);

    expect(problems).toEqual({});
    expect(input.variants[0]?.prices).toEqual([
      { currency: "GBP", amount: 4500, compareAtAmount: null },
    ]);
  });

  it("names the boxes that don't hold a number yet", () => {
    const draft = emptyProductDraft();
    const [variant] = draft.variants;
    if (!variant) throw new Error("A new product starts with one variant");
    variant.price = "lots";
    variant.weightGrams = "1.5";
    variant.stock = { warehouse: "a few" };

    const { problems } = productInputFromDraft(draft, "GBP", ["warehouse"]);

    expect(problems).toEqual({
      "variants.0.price": "price",
      "variants.0.weightGrams": "weight",
      "variants.0.stock": "stock",
    });
  });
});
