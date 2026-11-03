import { DEFAULT_TENANT_ID } from "../../database/columns.js";
import { abandonCheckout } from "../checkouts/checkout-expiry.js";
import { findCheckoutRow, lockCheckoutRow } from "../checkouts/checkouts.repository.js";
import type { CheckoutRow } from "../checkouts/checkouts.table.js";
import type { ShopContext } from "../commerce.context.js";
import { placeOrderForPayment } from "../orders/order-placement.service.js";
import { findOrderRow } from "../orders/orders.repository.js";
import type { OrderRow } from "../orders/orders.table.js";
import {
  type AfterCommit,
  followUpPlacement,
  runAfterCommit,
} from "../payments/payment-follow-up.js";

/**
 * What the test payment page does. Paying goes through `placeOrderForPayment` and the same
 * follow-up as a real payment, so stock, emails, discounts and tax are really exercised.
 * Whoever calls these has already checked the visitor's test session.
 */

export const testPaymentOutcomes = ["paid", "failed"] as const;
export type TestPaymentOutcome = (typeof testPaymentOutcomes)[number];

/** The checkout, if it's a test one that can still be paid. */
export async function findOpenTestCheckout(
  shop: ShopContext,
  checkoutId: string,
): Promise<CheckoutRow | undefined> {
  const checkout = await findCheckoutRow(shop.database, DEFAULT_TENANT_ID, checkoutId);
  return checkout?.paymentProvider === "test" && checkout.status === "open" ? checkout : undefined;
}

/** "gone" when it isn't a test checkout, or has timed out. Pressing twice places one order. */
export async function finishTestPayment(
  shop: ShopContext,
  checkoutId: string,
  outcome: TestPaymentOutcome,
): Promise<TestPaymentOutcome | "gone"> {
  const afterCommit: AfterCommit[] = [];
  const finished = await shop.database.transaction(
    async (transaction): Promise<TestPaymentOutcome | "gone"> => {
      const checkout = await lockCheckoutRow(transaction, DEFAULT_TENANT_ID, checkoutId);
      if (checkout?.paymentProvider !== "test") return "gone";
      if (checkout.status === "completed") return "paid";
      if (checkout.status !== "open") return "gone";
      if (outcome === "failed") {
        await abandonCheckout(transaction, checkout.id);
        return "failed";
      }
      const result = await placeOrderForPayment(
        transaction,
        checkout.id,
        {
          provider: "test",
          paymentIntentId: null,
          providerPaymentId: checkout.providerPaymentId,
          amount: checkout.totalAmount,
          currency: checkout.currency,
        },
        shop.now(),
      );
      followUpPlacement(shop, result, afterCommit);
      return "paid";
    },
  );
  await runAfterCommit(shop, afterCommit, `test checkout ${checkoutId}`);
  return finished;
}

/** The order a test checkout became, for the banner on the confirmation page. */
export async function findTestOrder(
  shop: ShopContext,
  checkoutId: string,
): Promise<OrderRow | undefined> {
  const checkout = await findCheckoutRow(shop.database, DEFAULT_TENANT_ID, checkoutId);
  if (checkout?.paymentProvider !== "test" || !checkout.orderId) return undefined;
  return findOrderRow(shop.database, checkout.orderId);
}
