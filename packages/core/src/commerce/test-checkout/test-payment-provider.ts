import type { PaymentProvider } from "../payments/payment-provider.js";

export const TEST_PAYMENT_PATH = "/_lintel/shop-test/pay";

/**
 * The test checkout behind the PaymentProvider interface. Nobody chooses it: a market can't
 * name it, and a checkout only gets it when the request carries a good test session (see
 * test-session.service.ts). No money is involved, so it has nothing to connect to or close.
 * The payment page is on the website itself, so it works on a computer with no public address.
 */
export function testPaymentProvider(): PaymentProvider {
  return {
    id: "test",
    checkReady: async () => {},
    needsPages: async () => true,
    async startPayment(checkout, pages) {
      if (!pages) throw new Error("The test checkout always needs the website's address");
      const url = new URL(TEST_PAYMENT_PATH, pages.successUrl);
      url.searchParams.set("checkout", checkout.id);
      return {
        url: url.toString(),
        clientSecret: null,
        saved: { providerPaymentId: `test_${checkout.id}` },
      };
    },
    closePayment: async () => {},
    refundPayment: async (_order, refund) => ({
      reference: `test_refund_${refund.id}`,
      status: "succeeded",
    }),
  };
}
