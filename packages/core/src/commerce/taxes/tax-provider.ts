import type { Address } from "../customers/address.schema.js";

/**
 * How the shop works out tax. Two providers ship with Lintel:
 *
 *   - Stripe Tax (stripe-tax-provider.ts), the default: Stripe knows the rules and rates
 *     for each country and region, and records each sale for its tax reports;
 *   - manual rates (manual-tax-provider.ts): a percentage per country typed in by hand,
 *     or none at all. For development, and for shops that handle tax themselves.
 *
 * Amounts are minor units of `currency`. `taxesIncluded` says whether the amounts already
 * contain tax (UK and EU style prices) or have it added on top (US style).
 */
export interface TaxRequest {
  currency: string;
  taxesIncluded: boolean;
  address: Address;
  lines: ReadonlyArray<{ reference: string; amount: number; quantity: number }>;
  shippingAmount: number;
  /** The same request with the same key gives the same answer; Stripe uses it to dedupe. */
  idempotencyKey: string;
}

export interface TaxResult {
  /** Tax on each line, by reference. Already inside the amount when taxes are included. */
  lineTaxes: Map<string, number>;
  shippingTax: number;
  /** All the tax on the order. */
  totalTax: number;
  calculation: "stripe" | "manual";
  /** Stripe's calculation id, to record the sale with Stripe once it's paid. */
  reference: string | null;
}

export interface TaxProvider {
  calculateTax(request: TaxRequest): Promise<TaxResult>;
}

/** The tax inside an amount that includes it, at `rate` percent: 20% of £120 is £20. */
export function taxIncludedIn(amount: number, rate: number): number {
  return Math.round(amount - amount / (1 + rate / 100));
}

/** The tax to add on top of an amount, at `rate` percent. */
export function taxOn(amount: number, rate: number): number {
  return Math.round((amount * rate) / 100);
}
