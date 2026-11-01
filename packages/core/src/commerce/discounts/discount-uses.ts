import type { Transaction } from "../../database/client.js";
import type { AppliedDiscount } from "../checkouts/checkouts.table.js";
import { availabilityProblem } from "./discount-rules.js";
import { DiscountCodeError } from "./discounts.errors.js";
import { countDiscountUsage, insertRedemption, lockDiscountRows } from "./discounts.repository.js";

/**
 * Holds one use of each stored discount on a checkout, inside the checkout's transaction.
 * The discounts are locked first and their uses counted again, so when two shoppers go to
 * pay with the last use of a code at the same moment, one gets it and the other is told
 * "This code has reached its usage limit" before paying anything.
 */
export async function holdDiscountUses(
  transaction: Transaction,
  checkoutId: string,
  discounts: readonly AppliedDiscount[],
  email: string,
  now: Date,
): Promise<void> {
  const discountIds = [
    ...new Set(discounts.flatMap((discount) => (discount.discountId ? [discount.discountId] : []))),
  ];
  const rows = await lockDiscountRows(transaction, discountIds);
  const usage = await countDiscountUsage(transaction, discountIds, email, now);
  for (const row of rows) {
    const problem = availabilityProblem(row, usage.get(row.id) ?? { total: 0, byCustomer: 0 }, now);
    if (problem) {
      const applied = discounts.find((discount) => discount.discountId === row.id);
      throw new DiscountCodeError(applied?.code || row.title, problem, 409);
    }
    await insertRedemption(transaction, { discountId: row.id, checkoutId, email });
  }
}
