import type { ManualTaxRate } from "../settings/shop-settings.table.js";
import {
  taxIncludedIn,
  taxOn,
  type TaxProvider,
  type TaxRequest,
  type TaxResult,
} from "./tax-provider.js";

/**
 * Tax at a fixed percentage per country, from Shop → Settings → Taxes. A country without a
 * rate pays no tax, so with no rates at all this is the "no tax" provider.
 */
export class ManualTaxProvider implements TaxProvider {
  constructor(
    private readonly rates: readonly ManualTaxRate[],
    private readonly taxShipping: boolean,
  ) {}

  async calculateTax(request: TaxRequest): Promise<TaxResult> {
    const rate =
      this.rates.find((candidate) => candidate.country === request.address.country)?.rate ?? 0;
    const tax = (amount: number) =>
      request.taxesIncluded ? taxIncludedIn(amount, rate) : taxOn(amount, rate);

    const lineTaxes = new Map(request.lines.map((line) => [line.reference, tax(line.amount)]));
    const shippingTax = this.taxShipping ? tax(request.shippingAmount) : 0;
    const linesTotal = [...lineTaxes.values()].reduce((sum, amount) => sum + amount, 0);
    return {
      lineTaxes,
      shippingTax,
      totalTax: linesTotal + shippingTax,
      calculation: "manual",
      reference: null,
    };
  }
}
