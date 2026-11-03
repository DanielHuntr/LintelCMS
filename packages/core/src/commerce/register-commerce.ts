import type { FastifyInstance } from "fastify";
import { type RepeatingJob, startRepeatingJob } from "../scheduler/repeating-job.js";
import { expireAbandonedCheckouts } from "./checkouts/checkout-expiry.js";
import { type CommerceOptions, createShopContext, type ShopContext } from "./commerce.context.js";
import { orderEventDefinitions } from "./orders/order-events.js";
import { startPaymentChecks } from "./payments/payment-checks.service.js";

declare module "fastify" {
  interface FastifyInstance {
    /** What the online shop's services need besides the database (see src/commerce). */
    shop: ShopContext;
  }
}

const ONE_MINUTE = 60_000;

/**
 * Everything the online shop adds to the server besides its routes (which are the
 * commerce plugin's, see commerce.plugin.ts): the shop's context, its order events on the
 * event bus, the job that releases stock held by abandoned checkouts, and the checks with
 * payment providers for a shop no webhook can reach.
 */
export function registerCommerce(server: FastifyInstance, options: CommerceOptions): void {
  const shop = createShopContext(server, options);
  server.decorate("shop", shop);
  for (const definition of orderEventDefinitions) server.events.declare(definition);

  if (!(options.runScheduledJobs ?? true)) return;
  let job: RepeatingJob | undefined;
  let paymentChecks: { stop(): Promise<void> } | undefined;
  server.addHook("onReady", async () => {
    paymentChecks = startPaymentChecks(shop);
    job = startRepeatingJob({
      everyMilliseconds: ONE_MINUTE,
      run: async () => {
        await expireAbandonedCheckouts(shop);
      },
      onError: (error) =>
        server.log.error(error, "Releasing stock from abandoned checkouts failed"),
    });
    server.scheduledJobs.add("abandoned-checkouts", job);
  });
  server.addHook("onClose", async () => {
    await job?.stop();
    await paymentChecks?.stop();
  });
}
