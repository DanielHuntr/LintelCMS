import type { FastifyInstance } from "fastify";
import { type RepeatingJob, startRepeatingJob } from "../scheduler/repeating-job.js";
import { expireAbandonedCheckouts } from "./checkouts/checkout-expiry.js";
import { type CommerceOptions, createShopContext, type ShopContext } from "./commerce.context.js";
import { orderEventDefinitions } from "./orders/order-events.js";

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
 * event bus, and the job that releases stock held by abandoned checkouts.
 */
export function registerCommerce(server: FastifyInstance, options: CommerceOptions): void {
  const shop = createShopContext(server, options);
  server.decorate("shop", shop);
  for (const definition of orderEventDefinitions) server.events.declare(definition);

  if (!(options.runScheduledJobs ?? true)) return;
  let job: RepeatingJob | undefined;
  server.addHook("onReady", async () => {
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
  server.addHook("onClose", async () => job?.stop());
}
