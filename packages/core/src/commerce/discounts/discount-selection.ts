import type {
  Discount,
  DiscountOutcome,
  DiscountProblem,
  DiscountRequest,
} from "./discount-provider.js";
import {
  availabilityProblem,
  calculateDiscount,
  conditionsProblem,
  type DiscountUsage,
  linesInScope,
} from "./discount-rules.js";
import type { DiscountRow } from "./discounts.table.js";

/**
 * Which discounts a cart gets. The rules, as the admin explains them:
 *
 *   - one code per order;
 *   - automatic discounts apply by themselves: the one that saves the most on the items,
 *     plus a free-shipping one if there is one;
 *   - a code and automatic discounts add up, unless one of them "can't be combined": then
 *     only the bigger saving applies (the code, when they're equal), and the shopper is told.
 */

export interface DiscountCandidates {
  /** Stored discounts for the codes entered, by upper-case code. */
  byCode: ReadonlyMap<string, DiscountRow>;
  automatic: readonly DiscountRow[];
  usage: ReadonlyMap<string, DiscountUsage>;
  collectionsByProduct: ReadonlyMap<string, ReadonlySet<string>>;
}

interface Qualified {
  row: DiscountRow;
  discount: Discount;
}

export function selectDiscounts(
  request: DiscountRequest,
  candidates: DiscountCandidates,
  now: Date,
): DiscountOutcome {
  const problems: DiscountProblem[] = [];
  const [firstCode, ...otherCodes] = request.codes;
  for (const code of otherCodes) {
    problems.push({ code, message: "Only one code can be used per order.", blocking: true });
  }

  let codeDiscount: Qualified | null = null;
  if (firstCode !== undefined) {
    const result = qualify(
      candidates.byCode.get(firstCode.toUpperCase()),
      request,
      candidates,
      now,
    );
    if ("problem" in result) {
      problems.push({ code: firstCode, ...result.problem });
    } else {
      codeDiscount = { ...result, discount: { ...result.discount, code: firstCode.toUpperCase() } };
    }
  }

  const automatic = candidates.automatic.flatMap((row) => {
    const result = qualify(row, request, candidates, now);
    return "problem" in result ? [] : [result];
  });
  const bestOnItems = biggest(automatic.filter((item) => !item.discount.freeShipping));
  const freeShipping = automatic.find((item) => item.discount.freeShipping) ?? null;
  let automaticChosen = [bestOnItems, freeShipping].filter((item) => item !== null);
  if (automaticChosen.some((item) => !item.row.combinesWithOthers)) {
    // An exclusive automatic discount applies alone, or not at all.
    automaticChosen = [
      biggest(automaticChosen.filter((item) => !item.row.combinesWithOthers)),
    ].filter((item) => item !== null);
  }

  if (!codeDiscount) {
    return { discounts: automaticChosen.map((item) => item.discount), problems };
  }
  const exclusive =
    !codeDiscount.row.combinesWithOthers ||
    automaticChosen.some((item) => !item.row.combinesWithOthers);
  if (!exclusive || automaticChosen.length === 0) {
    return {
      discounts: [codeDiscount.discount, ...automaticChosen.map((item) => item.discount)],
      problems,
    };
  }
  const automaticSaving = automaticChosen.reduce((sum, item) => sum + item.discount.amount, 0);
  if (codeDiscount.discount.amount >= automaticSaving) {
    return { discounts: [codeDiscount.discount], problems };
  }
  problems.push({
    code: codeDiscount.discount.code,
    message: `This code can't be combined with ${automaticChosen.map((item) => item.row.title).join(" and ")}, which saves you more.`,
    blocking: false,
  });
  return { discounts: automaticChosen.map((item) => item.discount), problems };
}

function qualify(
  row: DiscountRow | undefined,
  request: DiscountRequest,
  candidates: DiscountCandidates,
  now: Date,
): Qualified | { problem: Omit<DiscountProblem, "code"> } {
  if (!row) {
    return {
      problem: { message: "This code isn't valid. Check it's typed correctly.", blocking: true },
    };
  }
  const usage = candidates.usage.get(row.id) ?? { total: 0, byCustomer: 0 };
  const unavailable = availabilityProblem(row, usage, now);
  if (unavailable) {
    return { problem: { message: unavailable, blocking: true } };
  }
  const inScope = linesInScope(row, request.lines, candidates.collectionsByProduct);
  const unmet = conditionsProblem(row, inScope, request.currency);
  if (unmet) {
    return { problem: { message: unmet, blocking: false } };
  }
  return { row, discount: calculateDiscount(row, inScope, request.currency) };
}

function biggest(items: readonly Qualified[]): Qualified | null {
  return items.reduce<Qualified | null>(
    (best, item) => (best === null || item.discount.amount > best.discount.amount ? item : best),
    null,
  );
}
