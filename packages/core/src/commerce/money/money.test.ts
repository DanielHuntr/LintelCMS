import { describe, expect, it } from "vitest";
import { currencyDecimalPlaces, isCountryCode, isCurrencyCode } from "./currencies.js";
import {
  addMoney,
  allocateAmount,
  CurrencyMismatchError,
  money,
  multiplyMoney,
  sumMoney,
} from "./money.js";
import { formatMoney } from "./money-format.js";
import { convertPrice, roundPrice } from "./price-conversion.js";

describe("money", () => {
  it("keeps amounts in whole minor units and refuses to mix currencies", () => {
    expect(addMoney(money(1999, "EUR"), money(1, "EUR"))).toEqual(money(2000, "EUR"));
    expect(multiplyMoney(money(1999, "EUR"), 3)).toEqual(money(5997, "EUR"));
    expect(sumMoney([money(100, "GBP"), money(250, "GBP")], "GBP")).toEqual(money(350, "GBP"));
    expect(() => addMoney(money(1, "EUR"), money(1, "USD"))).toThrow(CurrencyMismatchError);
    expect(() => money(19.99, "EUR")).toThrow(RangeError);
  });

  it("knows each currency's decimal places from Intl", () => {
    expect(currencyDecimalPlaces("EUR")).toBe(2);
    expect(currencyDecimalPlaces("JPY")).toBe(0);
    expect(currencyDecimalPlaces("KWD")).toBe(3);
    expect(isCurrencyCode("EUR")).toBe(true);
    expect(isCurrencyCode("ABC")).toBe(false);
    expect(isCountryCode("GB")).toBe(true);
    expect(isCountryCode("XQ")).toBe(false);
  });

  it("formats amounts the way each locale writes them", () => {
    expect(formatMoney(money(1999, "EUR"), "en")).toBe("€19.99");
    expect(formatMoney(money(1999, "JPY"), "en")).toBe("¥1,999");
    expect(formatMoney(money(1999, "EUR"), "de-DE")).toBe("19,99 €");
    expect(formatMoney(money(1500, "KWD"), "en")).toBe("KWD 1.500");
  });

  it("splits an amount so the parts always add back up", () => {
    expect(allocateAmount(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocateAmount(1000, [2999, 1000])).toEqual([750, 250]);
    expect(allocateAmount(5, [0, 0])).toEqual([5, 0]);
  });
});

describe("converting prices for a market", () => {
  it("converts between currencies with different decimal places", () => {
    expect(convertPrice(money(1234, "EUR"), "USD", 1.17, "exact")).toEqual(money(1444, "USD"));
    expect(convertPrice(money(1000, "EUR"), "JPY", 162.5, "exact")).toEqual(money(1625, "JPY"));
    expect(convertPrice(money(1625, "JPY"), "EUR", 0.0061538, "exact")).toEqual(money(1000, "EUR"));
  });

  it("rounds by the market's rule", () => {
    expect(roundPrice(1444, "USD", "whole")).toBe(1500);
    expect(roundPrice(1500, "USD", "whole")).toBe(1500);
    expect(roundPrice(1444, "USD", "ninety_nine")).toBe(1499);
    expect(roundPrice(1499, "USD", "ninety_nine")).toBe(1499);
    expect(roundPrice(1500, "USD", "ninety_nine")).toBe(1599);
    expect(roundPrice(1234, "JPY", "whole")).toBe(1300);
    expect(roundPrice(1234, "JPY", "ninety_nine")).toBe(1299);
  });

  it("never converts a price that is already in the currency", () => {
    expect(convertPrice(money(1234, "EUR"), "EUR", 2, "whole")).toEqual(money(1234, "EUR"));
  });
});
