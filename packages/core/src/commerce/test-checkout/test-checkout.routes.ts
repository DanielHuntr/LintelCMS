import type { FastifyInstance } from "fastify";
import { getSignedIn, requirePermission } from "../../auth/require-permission.js";
import type { ShopContext } from "../commerce.context.js";
import { deleteTestOrders, summariseTestOrders } from "./test-orders.service.js";
import { startTestSession } from "./test-session.service.js";

/**
 * HTTP only. Trying the shop, for people who run it. Everything that happens on the website
 * is in test-checkout-site.routes.ts.
 *
 *   POST   /shop/test-session   (commerce:update)  -> 201 { url, expiresAt }
 *   GET    /shop/test-orders    (commerce:read)    -> { count }
 *   DELETE /shop/test-orders    (commerce:update)  -> { deleted }
 */
export async function testCheckoutRoutes(server: FastifyInstance, { shop }: { shop: ShopContext }) {
  const read = { preHandler: requirePermission("commerce:read") };
  const update = { preHandler: requirePermission("commerce:update") };

  server.post("/shop/test-session", update, async (request, reply) => {
    const started = await startTestSession(
      shop,
      getSignedIn(request).user.id,
      server.website.builtInSiteUrl,
    );
    return reply.code(201).header("cache-control", "no-store").send(started);
  });

  server.get("/shop/test-orders", read, async () => summariseTestOrders(shop));

  server.delete("/shop/test-orders", update, async () => deleteTestOrders(shop));
}
