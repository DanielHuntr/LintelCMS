import type { CurrencyCode } from "../money/currencies.js";

/**
 * The hook discounts will plug into. Lintel doesn't have discount codes yet; this is the
 * seam they will use, so the cart and checkout already do the arithmetic for them (spread
 * over the lines before tax, see carts/cart-pricing.ts).
 *
 * A provider is asked about every cart and returns what to take off. It must never
 * return more than the subtotal; the cart caps it there anyway.
 */
export interface DiscountRequest {
  currency: CurrencyCode;
  marketId: string;
  codes: readonly string[];
  email: string | null;
  lines: ReadonlyArray<{
    variantId: string;
    productId: string;
    quantity: number;
    subtotalAmount: number;
  }>;
  subtotalAmount: number;
}

export interface Discount {
  code: string;
  title: string;
  /** Minor units of the cart's currency, taken off the order before tax. */
  amount: number;
}

export interface DiscountProvider {
  findDiscounts(request: DiscountRequest): Promise<Discount[]>;
}

/** The default: no discounts, whatever codes are entered. */
export const noDiscounts: DiscountProvider = {
  findDiscounts: async () => [],
};
