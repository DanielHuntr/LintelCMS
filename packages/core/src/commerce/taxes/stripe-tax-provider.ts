import { createStripeTaxCalculation } from "../payments/stripe-api.js";
import type { StripeClient } from "../payments/stripe-client.js";
import type { TaxProvider, TaxRequest, TaxResult } from "./tax-provider.js";

/**
 * Tax from Stripe Tax (POST /v1/tax/calculations). Stripe needs Stripe Tax switched on for
 * the account, with the places the shop is registered for tax; until then it answers with
 * an error, which the checkout passes on in plain words.
 *
 * Each line's reference is the variant id, so Stripe's answer can be matched back.
 */
export class StripeTaxProvider implements TaxProvider {
  constructor(private readonly stripe: StripeClient) {}

  async calculateTax(request: TaxRequest): Promise<TaxResult> {
    const taxBehavior = request.taxesIncluded ? "inclusive" : "exclusive";
    const calculation = await createStripeTaxCalculation(
      this.stripe,
      {
        currency: request.currency.toLowerCase(),
        customer_details: {
          address_source: "shipping",
          address: {
            line1: request.address.line1,
            line2: request.address.line2 || undefined,
            city: request.address.city,
            state: request.address.region || undefined,
            postal_code: request.address.postalCode || undefined,
            country: request.address.country,
          },
        },
        line_items: request.lines.map((line) => ({
          amount: line.amount,
          quantity: line.quantity,
          reference: line.reference,
          tax_behavior: taxBehavior,
        })),
        shipping_cost: { amount: request.shippingAmount, tax_behavior: taxBehavior },
        expand: ["line_items"],
      },
      request.idempotencyKey,
    );

    const lineTaxes = new Map<string, number>(
      (calculation.line_items?.data ?? []).flatMap((line) =>
        line.reference ? [[line.reference, line.amount_tax] as const] : [],
      ),
    );
    return {
      lineTaxes,
      shippingTax: calculation.shipping_cost?.amount_tax ?? 0,
      totalTax: calculation.tax_amount_exclusive + calculation.tax_amount_inclusive,
      calculation: "stripe",
      reference: calculation.id ?? null,
    };
  }
}
