/**
 * Lintel counts money in the currency's real minor units (see currencies.ts): 0 decimal
 * places for the Icelandic króna and the Ugandan shilling. Stripe is the exception: it treats
 * ISK and UGX as two-decimal currencies, so ISK 10,000 is `1000000` there. Sent as `10000`,
 * Stripe would charge ISK 100. Every amount going to Stripe goes through `toStripeAmount`
 * and every amount coming back through `fromStripeAmount`.
 * https://docs.stripe.com/currencies#special-cases
 */
const TWO_DECIMALS_AT_STRIPE_ONLY = new Set(["ISK", "UGX"]);

function stripeFactor(currency: string): number {
  return TWO_DECIMALS_AT_STRIPE_ONLY.has(currency.toUpperCase()) ? 100 : 1;
}

export function toStripeAmount(amount: number, currency: string): number {
  return amount * stripeFactor(currency);
}

export function fromStripeAmount(amount: number, currency: string): number {
  return Math.round(amount / stripeFactor(currency));
}
