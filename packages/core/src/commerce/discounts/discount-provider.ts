import type { CurrencyCode } from "../money/currencies.js";

/**
 * The seam discounts plug into. The cart asks the provider about every cart and gets back
 * what to take off, and why any code it was given doesn't apply. The cart does the rest:
 * it caps discounts at the subtotal, spreads order-wide ones over the lines before tax
 * (carts/cart-pricing.ts) and makes delivery free for free-shipping ones.
 *
 * The shop's own discounts (Shop → Discounts) are `storedDiscounts`, the default. Another
 * provider can be passed as `buildServer({ commerce: { discountProvider } })`.
 */
export interface DiscountRequest {
  currency: CurrencyCode;
  marketId: string;
  codes: readonly string[];
  email: string | null;
  lines: ReadonlyArray<{
    /** The cart line's id, which `lineAmounts` refer to. */
    lineId: string;
    variantId: string;
    productId: string;
    quantity: number;
    unitAmount: number;
    subtotalAmount: number;
  }>;
  subtotalAmount: number;
}

export interface Discount {
  /** The code typed in, or "" for an automatic discount. */
  code: string;
  title: string;
  /** Minor units of the cart's currency taken off the items, before tax. */
  amount: number;
  /** The stored discount this came from, so its uses can be counted. */
  discountId?: string;
  /**
   * How `amount` falls on particular lines, by cart line id, for discounts on some products
   * only. Left out, the cart spreads it over every line in proportion.
   */
  lineAmounts?: Readonly<Record<string, number>>;
  /** Delivery is free. `amount` is then 0; the cart fills in what the delivery would cost. */
  freeShipping?: boolean;
}

/**
 * Why a code doesn't apply. `blocking` problems (unknown, expired, used up) mean the code
 * can't be used at all, so the cart refuses it; the others (spend more, add the right
 * products) may sort themselves out, so the code stays in the cart with the message.
 */
export interface DiscountProblem {
  code: string;
  message: string;
  blocking: boolean;
}

export interface DiscountOutcome {
  discounts: Discount[];
  problems: DiscountProblem[];
}

export interface DiscountProvider {
  findDiscounts(request: DiscountRequest): Promise<DiscountOutcome>;
}

/** No discounts, whatever codes are entered. */
export const noDiscounts: DiscountProvider = {
  findDiscounts: async (request) => ({
    discounts: [],
    problems: request.codes.map((code) => ({
      code,
      message: "This code isn't valid.",
      blocking: true,
    })),
  }),
};
