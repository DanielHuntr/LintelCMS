import type { PricedCart } from "../carts/cart-loading.js";
import type { TaxResult } from "../taxes/tax-provider.js";
import type { PricedLine, ShippingLine } from "./checkouts.table.js";

/**
 * The frozen sums for a checkout: what each line costs after discounts, its tax, shipping,
 * and the total Stripe will be asked for.
 *
 *   total = subtotal − discounts + shipping (+ tax, when prices don't include it)
 */
export interface CheckoutTotals {
  lines: PricedLine[];
  shippingLine: ShippingLine;
  subtotalAmount: number;
  discountAmount: number;
  shippingAmount: number;
  taxAmount: number;
  totalAmount: number;
  taxesIncluded: boolean;
}

export function checkoutTotals(cart: PricedCart, tax: TaxResult): CheckoutTotals {
  const shipping = cart.chosenShipping;
  if (!shipping) {
    throw new Error("A checkout needs a shipping rate");
  }
  const taxesIncluded = cart.market.pricesIncludeTax;
  const lines: PricedLine[] = cart.lines
    .filter((line) => line.problem === null)
    .map((line) => ({
      variantId: line.variantId,
      productId: line.productId ?? "",
      productTitle: line.productTitle,
      variantTitle: line.variantTitle,
      sku: line.sku,
      imageId: line.imageId,
      quantity: line.quantity,
      unitAmount: line.unitPrice?.amount ?? 0,
      subtotalAmount: line.subtotal.amount,
      discountAmount: line.discountAmount,
      taxAmount: tax.lineTaxes.get(line.variantId) ?? 0,
      weightGrams: line.weightGrams,
    }));
  const subtotalAmount = lines.reduce((sum, line) => sum + line.subtotalAmount, 0);
  const discountAmount = lines.reduce((sum, line) => sum + line.discountAmount, 0);
  const shippingAmount = shipping.amount.amount;
  const taxAmount = tax.totalTax;
  return {
    lines,
    shippingLine: {
      rateId: shipping.rateId,
      name: shipping.name,
      amount: shippingAmount,
      taxAmount: tax.shippingTax,
    },
    subtotalAmount,
    discountAmount,
    shippingAmount,
    taxAmount,
    totalAmount: subtotalAmount - discountAmount + shippingAmount + (taxesIncluded ? 0 : taxAmount),
    taxesIncluded,
  };
}
