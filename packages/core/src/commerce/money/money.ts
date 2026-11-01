import { z } from "zod";
import { type CurrencyCode, currencyCodeSchema } from "./currencies.js";

/**
 * An amount of money in a currency's smallest unit: `{ amount: 1999, currency: "EUR" }` is
 * €19.99, `{ amount: 1999, currency: "JPY" }` is ¥1,999. Always a whole number, so adding up
 * an order never picks up floating-point pennies.
 */
export interface Money {
  amount: number;
  currency: CurrencyCode;
}

export const minorAmountSchema = z
  .number({ error: "Amounts should be whole numbers in the currency's smallest unit" })
  .int({ error: "Amounts should be whole numbers in the currency's smallest unit (cents, pence)" })
  .min(0, { error: "Amounts can't be negative" })
  .max(100_000_000_000, { error: "That amount is too large" });

export const moneySchema = z.object({ amount: minorAmountSchema, currency: currencyCodeSchema });

export class CurrencyMismatchError extends Error {
  constructor(first: string, second: string) {
    super(`Can't add ${first} and ${second} together; convert one of them first.`);
    this.name = "CurrencyMismatchError";
  }
}

export function money(amount: number, currency: CurrencyCode): Money {
  if (!Number.isSafeInteger(amount)) {
    throw new RangeError(`Money amounts are whole minor units, not ${amount}`);
  }
  return { amount, currency };
}

export function zeroMoney(currency: CurrencyCode): Money {
  return { amount: 0, currency };
}

export function addMoney(first: Money, second: Money): Money {
  assertSameCurrency(first, second);
  return money(first.amount + second.amount, first.currency);
}

export function subtractMoney(first: Money, second: Money): Money {
  assertSameCurrency(first, second);
  return money(first.amount - second.amount, first.currency);
}

export function multiplyMoney(price: Money, quantity: number): Money {
  if (!Number.isInteger(quantity)) {
    throw new RangeError(`Quantities are whole numbers, not ${quantity}`);
  }
  return money(price.amount * quantity, price.currency);
}

export function sumMoney(amounts: readonly Money[], currency: CurrencyCode): Money {
  return amounts.reduce(addMoney, zeroMoney(currency));
}

/**
 * Splits an amount across parts in proportion to their weights, so the parts always add up
 * to exactly the amount (the leftover minor units go to the largest remainders). Used to
 * spread a discount over an order's lines before tax.
 */
export function allocateAmount(amount: number, weights: readonly number[]): number[] {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (weights.length === 0) {
    return [];
  }
  if (totalWeight === 0) {
    return weights.map((_, index) => (index === 0 ? amount : 0));
  }
  const exact = weights.map((weight) => (amount * weight) / totalWeight);
  const parts = exact.map(Math.floor);
  let leftover = amount - parts.reduce((sum, part) => sum + part, 0);
  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((first, second) => second.remainder - first.remainder);
  for (const { index } of byRemainder) {
    if (leftover <= 0) break;
    parts[index] = (parts[index] ?? 0) + 1;
    leftover -= 1;
  }
  return parts;
}

function assertSameCurrency(first: Money, second: Money): void {
  if (first.currency !== second.currency) {
    throw new CurrencyMismatchError(first.currency, second.currency);
  }
}
