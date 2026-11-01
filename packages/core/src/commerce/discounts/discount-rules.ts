import { allocateAmount } from "../money/money.js";
import { formatMoney } from "../money/money-format.js";
import type { Discount, DiscountRequest } from "./discount-provider.js";
import type { DiscountRow } from "./discounts.table.js";

/**
 * The arithmetic and the conditions of the shop's own discounts, as pure functions over
 * rows already loaded (see stored-discounts.ts), so every rule is easy to test.
 *
 * Amounts are whole minor units throughout. A percentage is worked out once on the items
 * in scope and rounded half up, then shared across their lines with `allocateAmount`, so
 * the lines always add up to exactly the discount.
 */

export type RequestLine = DiscountRequest["lines"][number];

/** How often a discount has been used: by everyone, and by this shopper's email. */
export interface DiscountUsage {
  total: number;
  byCustomer: number;
}

/** Why a discount can't be used at all right now, or null when it can. */
export function availabilityProblem(
  discount: DiscountRow,
  usage: DiscountUsage,
  now: Date,
): string | null {
  if (!discount.enabled) return "This code isn't available at the moment.";
  if (discount.startsAt > now) {
    return `This code can't be used until ${formatDate(discount.startsAt)}.`;
  }
  if (discount.endsAt && discount.endsAt <= now) return "This code has expired.";
  if (discount.usageLimit !== null && usage.total >= discount.usageLimit) {
    return "This code has reached its usage limit.";
  }
  if (discount.perCustomerLimit !== null && usage.byCustomer >= discount.perCustomerLimit) {
    return discount.perCustomerLimit === 1
      ? "You've already used this code."
      : `You've already used this code ${discount.perCustomerLimit} times, which is the most allowed.`;
  }
  return null;
}

/** The lines a discount looks at: every line, or those of its products or collections. */
export function linesInScope(
  discount: DiscountRow,
  lines: readonly RequestLine[],
  collectionsByProduct: ReadonlyMap<string, ReadonlySet<string>>,
): RequestLine[] {
  switch (discount.scope) {
    case "order":
      return [...lines];
    case "products":
      return lines.filter((line) => discount.productIds.includes(line.productId));
    case "collections":
      return lines.filter((line) => {
        const collections = collectionsByProduct.get(line.productId);
        return discount.collectionIds.some((collectionId) => collections?.has(collectionId));
      });
  }
}

/**
 * Why the cart doesn't qualify yet, or null when it does. These can change as the shopper
 * adds things, so the code stays in the cart with the message.
 */
export function conditionsProblem(
  discount: DiscountRow,
  inScope: readonly RequestLine[],
  currency: string,
): string | null {
  if (inScope.length === 0) {
    return discount.scope === "order"
      ? "Add something to your cart to use this code."
      : "This code doesn't apply to anything in your cart.";
  }
  if (discount.kind === "fixed_amount" && !(currency in discount.amounts)) {
    return `This code can't be used when paying in ${currency}.`;
  }
  const quantity = inScope.reduce((sum, line) => sum + line.quantity, 0);
  const spend = inScope.reduce((sum, line) => sum + line.subtotalAmount, 0);
  const minimumSpend = discount.minimumSpend[currency];
  if (minimumSpend !== undefined && spend < minimumSpend) {
    const amount = formatMoney({ amount: minimumSpend, currency });
    return discount.scope === "order"
      ? `Spend ${amount} or more to use this code.`
      : `Spend ${amount} or more on the items this code is for to use it.`;
  }
  if (discount.minimumQuantity !== null && quantity < discount.minimumQuantity) {
    return `Add ${discount.minimumQuantity} or more of the items this code is for to use it.`;
  }
  if (discount.kind === "buy_x_get_y" && quantity < discount.buyQuantity + discount.getQuantity) {
    return `Add ${discount.buyQuantity + discount.getQuantity} of the items this offer is for to get it.`;
  }
  return null;
}

/** What a qualifying discount takes off, line by line. */
export function calculateDiscount(
  discount: DiscountRow,
  inScope: readonly RequestLine[],
  currency: string,
): Discount {
  const base = {
    code: discount.method === "code" ? (discount.code ?? "") : "",
    title: discount.title,
    discountId: discount.id,
  };
  if (discount.kind === "free_shipping") {
    return { ...base, amount: 0, freeShipping: true };
  }
  const lineAmounts =
    discount.kind === "buy_x_get_y"
      ? buyXGetYLineAmounts(discount, inScope)
      : spreadOverLines(wholeAmountOff(discount, inScope, currency), inScope);
  const amount = Object.values(lineAmounts).reduce((sum, part) => sum + part, 0);
  return { ...base, amount, lineAmounts };
}

function wholeAmountOff(
  discount: DiscountRow,
  inScope: readonly RequestLine[],
  currency: string,
): number {
  const spend = inScope.reduce((sum, line) => sum + line.subtotalAmount, 0);
  if (discount.kind === "percentage") {
    return Math.min(spend, percentOf(spend, discount.percentOff));
  }
  return Math.min(spend, discount.amounts[currency] ?? 0);
}

function spreadOverLines(amount: number, lines: readonly RequestLine[]): Record<string, number> {
  const shares = allocateAmount(
    amount,
    lines.map((line) => line.subtotalAmount),
  );
  return Object.fromEntries(lines.map((line, index) => [line.lineId, shares[index] ?? 0]));
}

/**
 * Every unit in scope, dearest first, in groups of buy + get. In each group the last `get`
 * units (the cheapest of the group) are discounted, so the shopper always pays full price
 * for the dearer items, as they'd expect from "buy 2, get 1 free".
 */
function buyXGetYLineAmounts(
  discount: DiscountRow,
  inScope: readonly RequestLine[],
): Record<string, number> {
  const groupSize = discount.buyQuantity + discount.getQuantity;
  const units = inScope
    .flatMap((line) => Array.from({ length: line.quantity }, () => line))
    .sort((first, second) => second.unitAmount - first.unitAmount);
  const lineAmounts: Record<string, number> = {};
  const wholeGroups = Math.floor(units.length / groupSize) * groupSize;
  units.slice(0, wholeGroups).forEach((line, index) => {
    if (index % groupSize >= discount.buyQuantity) {
      lineAmounts[line.lineId] =
        (lineAmounts[line.lineId] ?? 0) + percentOf(line.unitAmount, discount.percentOff);
    }
  });
  return lineAmounts;
}

/** A percentage of a whole amount, rounded half up to a whole minor unit. */
export function percentOf(amount: number, percent: number): number {
  return Math.floor((amount * percent) / 100 + 0.5);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
