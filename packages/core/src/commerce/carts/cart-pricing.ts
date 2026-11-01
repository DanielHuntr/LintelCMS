import type { Discount } from "../discounts/discount-provider.js";
import type { VariantStock } from "../inventory/inventory.service.js";
import { priceInMarket } from "../markets/market-prices.js";
import type { MarketRow } from "../markets/markets.table.js";
import { allocateAmount, type Money } from "../money/money.js";
import type { ProductRow, VariantPriceRow, VariantRow } from "../products/products.table.js";
import type { CartLineRow } from "./carts.table.js";

/**
 * Works out what a cart costs in its market: each line's price, what the discounts take
 * off it, and the totals. Pure arithmetic over rows already loaded, so it's easy to test
 * and the checkout prices a cart exactly as the cart showed it.
 */

export type LineProblem = "unavailable" | "no_price" | "out_of_stock" | "not_enough_stock";

export interface PricedCartLine {
  id: string;
  variantId: string;
  productId: string | null;
  productTitle: string;
  productHandle: string | null;
  variantTitle: string;
  sku: string | null;
  imageId: string | null;
  quantity: number;
  weightGrams: number;
  unitPrice: Money | null;
  compareAtPrice: Money | null;
  subtotal: Money;
  discountAmount: number;
  /** How many can be bought now; null when stock isn't tracked. */
  quantityAvailable: number | null;
  /** Why this line can't be checked out as it is; null when it can. */
  problem: LineProblem | null;
}

export interface CartCatalogue {
  variants: ReadonlyMap<string, VariantRow>;
  products: ReadonlyMap<string, ProductRow>;
  prices: readonly VariantPriceRow[];
  stock: ReadonlyMap<string, VariantStock>;
}

export function priceCartLines(
  lines: readonly CartLineRow[],
  catalogue: CartCatalogue,
  market: MarketRow,
  primaryCurrency: string,
): PricedCartLine[] {
  return lines.map((line) => {
    const variant = catalogue.variants.get(line.variantId);
    const product = variant ? catalogue.products.get(variant.productId) : undefined;
    const prices = catalogue.prices.filter((price) => price.variantId === line.variantId);
    const marketPrice = variant ? priceInMarket(prices, market, primaryCurrency) : null;
    const stock = catalogue.stock.get(line.variantId);
    const quantityAvailable = variant?.inventoryTracked ? (stock?.available ?? 0) : null;
    const unitAmount = marketPrice?.price.amount ?? 0;
    return {
      id: line.id,
      variantId: line.variantId,
      productId: product?.id ?? null,
      productTitle: product?.title ?? "Item no longer available",
      productHandle: product?.handle ?? null,
      variantTitle: variant?.title ?? "",
      sku: variant?.sku ?? null,
      imageId: product?.mediaIds[0] ?? null,
      quantity: line.quantity,
      weightGrams: variant?.weightGrams ?? 0,
      unitPrice: marketPrice?.price ?? null,
      compareAtPrice: marketPrice?.compareAtPrice ?? null,
      subtotal: { amount: unitAmount * line.quantity, currency: market.currency },
      discountAmount: 0,
      quantityAvailable,
      problem: lineProblem(product, marketPrice !== null, line.quantity, quantityAvailable),
    };
  });
}

/**
 * Takes the discounts off the lines that can be bought, so tax is worked out on what's
 * really paid. A discount that says which lines it falls on (`lineAmounts`) is taken off
 * those; any other is spread over every line in proportion to what is left of it. No line
 * ever goes below zero. Free-shipping discounts pass through for the delivery to use.
 */
export function applyDiscounts(
  lines: readonly PricedCartLine[],
  discounts: readonly Discount[],
): { lines: PricedCartLine[]; discountTotal: number; applied: Discount[] } {
  const buyable = lines.filter((line) => line.problem === null);
  const remaining = new Map(buyable.map((line) => [line.id, line.subtotal.amount]));
  const taken = new Map(buyable.map((line) => [line.id, 0]));
  const take = (lineId: string, wanted: number): number => {
    const amount = Math.min(Math.max(0, Math.round(wanted)), remaining.get(lineId) ?? 0);
    remaining.set(lineId, (remaining.get(lineId) ?? 0) - amount);
    taken.set(lineId, (taken.get(lineId) ?? 0) + amount);
    return amount;
  };

  const applied = discounts.flatMap((discount) => {
    if (discount.freeShipping) {
      return [{ ...discount, amount: 0 }];
    }
    let amount = 0;
    if (discount.lineAmounts) {
      for (const line of buyable) {
        amount += take(line.id, discount.lineAmounts[line.id] ?? 0);
      }
    } else {
      const left = buyable.map((line) => remaining.get(line.id) ?? 0);
      const wanted = Math.min(
        Math.max(0, Math.round(discount.amount)),
        left.reduce((sum, value) => sum + value, 0),
      );
      const shares = allocateAmount(wanted, left);
      buyable.forEach((line, index) => {
        amount += take(line.id, shares[index] ?? 0);
      });
    }
    return amount > 0 ? [{ ...discount, amount }] : [];
  });
  const discountTotal = [...taken.values()].reduce((sum, value) => sum + value, 0);
  return {
    lines: lines.map((line) => ({ ...line, discountAmount: taken.get(line.id) ?? 0 })),
    discountTotal,
    applied,
  };
}

function lineProblem(
  product: ProductRow | undefined,
  hasPrice: boolean,
  quantity: number,
  quantityAvailable: number | null,
): LineProblem | null {
  if (!product || product.status !== "active") return "unavailable";
  if (!hasPrice) return "no_price";
  if (quantityAvailable !== null && quantityAvailable === 0) return "out_of_stock";
  if (quantityAvailable !== null && quantity > quantityAvailable) return "not_enough_stock";
  return null;
}
