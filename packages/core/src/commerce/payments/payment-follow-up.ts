import type { ShopContext } from "../commerce.context.js";
import { sendOrderConfirmation } from "../emails/order-notifications.js";
import type { PlacementResult } from "../orders/order-placement.service.js";
import { insertOrderEvent } from "../orders/orders.repository.js";
import { createStripeTaxTransaction } from "./stripe-api.js";

/**
 * What happens after a payment webhook's transaction has committed: the things that talk
 * to the outside world (the confirmation email, recording tax with Stripe), so a failure
 * there never undoes the order. Shared by the Stripe, PayPal and Mollie webhooks.
 */
export type AfterCommit = () => Promise<void>;

export async function runAfterCommit(
  shop: ShopContext,
  actions: readonly AfterCommit[],
  label: string,
): Promise<void> {
  for (const action of actions) {
    try {
      await action();
    } catch (error) {
      shop.log.error(error, `Following up ${label} failed`);
    }
  }
}

export function followUpPlacement(
  shop: ShopContext,
  result: PlacementResult,
  afterCommit: AfterCommit[],
): void {
  if (result.outcome === "needs_review") {
    shop.log.warn(`Checkout ${result.checkout.id} needs review: ${result.checkout.problem ?? ""}`);
    return;
  }
  if (result.outcome !== "placed") return;
  const { order, checkout } = result;
  afterCommit.push(() => sendOrderConfirmation(shop, order.id));
  if (checkout.taxCalculation === "stripe" && checkout.taxReference) {
    const calculationId = checkout.taxReference;
    afterCommit.push(async () => {
      try {
        await createStripeTaxTransaction(await shop.stripe(), calculationId, order.id);
      } catch (error) {
        shop.log.error(error, `Recording the tax for order ${order.name} with Stripe failed`);
        await insertOrderEvent(shop.database, {
          orderId: order.id,
          kind: "tax_not_recorded",
          message:
            "The tax on this order couldn't be recorded with Stripe Tax. Add it to your tax report by hand.",
        });
      }
    });
  }
}
