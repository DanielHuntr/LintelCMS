import type { CheckoutRow } from "../checkouts/checkouts.table.js";
import type { OrderRow, RefundStatus } from "../orders/orders.table.js";

/**
 * How the shop takes money, whoever takes it. Stripe is the default; PayPal and Mollie can
 * be connected too, and each market says which one its shoppers pay with.
 *
 * Every provider sends shoppers to a page it serves itself (or, for Stripe's Payment
 * Element, an iframe it serves), so card details never reach Lintel and the shop stays
 * within PCI SAQ A. None of them marks anything paid when a payment starts: an order is
 * made only when the provider confirms the payment in a way that can't be forged (a signed
 * Stripe webhook, a PayPal webhook PayPal has verified, or a Mollie payment fetched back
 * from Mollie with the shop's own key).
 */
export const marketPaymentProviderIds = ["stripe", "paypal", "mollie"] as const;
export type MarketPaymentProviderId = (typeof marketPaymentProviderIds)[number];

/**
 * Every provider a checkout or an order can have. "test" is the test checkout (see
 * ../test-checkout): it takes no money, so it can never be a market's choice, only what a
 * signed test session's own checkouts use.
 */
export const paymentProviderIds = [...marketPaymentProviderIds, "test"] as const;
export type PaymentProviderId = (typeof paymentProviderIds)[number];

export const PAYMENT_PROVIDER_NAMES: Record<PaymentProviderId, string> = {
  stripe: "Stripe",
  paypal: "PayPal",
  mollie: "Mollie",
  test: "the test checkout",
};

/** Who takes payments in a market: its own choice, or Stripe. */
export function marketPaymentProvider(market: {
  paymentProvider: MarketPaymentProviderId | null;
}): MarketPaymentProviderId {
  return market.paymentProvider ?? "stripe";
}

/** Where the provider's payment page sends the shopper back to. */
export interface PaymentPages {
  successUrl: string;
  cancelUrl: string;
}

export interface StartedPayment {
  /** Send the shopper here (hosted pages). */
  url: string | null;
  /** Stripe's Payment Element only. */
  clientSecret: string | null;
  /** What is saved on the checkout to find it again. */
  saved: {
    providerPaymentId?: string | null;
    stripeCheckoutSessionId?: string | null;
    stripePaymentIntentId?: string | null;
  };
}

export interface ProviderRefund {
  /** The provider's id for the refund. */
  reference: string;
  status: RefundStatus;
}

export interface PaymentProvider {
  readonly id: PaymentProviderId;
  /** Throws a plain "connect it first" error when the provider isn't connected. */
  checkReady(): Promise<void>;
  /** Whether the shopper must be sent back somewhere, so success and cancel pages are needed. */
  needsPages(): Promise<boolean>;
  startPayment(checkout: CheckoutRow, pages: PaymentPages | null): Promise<StartedPayment>;
  /** Makes an unpaid payment unusable. Failures are the caller's to log. */
  closePayment(checkout: CheckoutRow): Promise<void>;
  refundPayment(order: OrderRow, refund: { id: string; amount: number }): Promise<ProviderRefund>;
}

/** The provider refused or couldn't be reached; `message` is the provider's own words. */
export class ProviderRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ProviderRequestError";
  }
}
