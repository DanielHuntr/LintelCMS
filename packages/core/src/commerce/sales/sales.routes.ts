import type { FastifyInstance } from "fastify";
import { requirePermission } from "../../auth/require-permission.js";
import { parseRequest } from "../../http/http-errors.js";
import type { ShopContext } from "../commerce.context.js";
import { salesSummaryQuerySchema } from "./sales.schema.js";
import { summariseSales } from "./sales.service.js";

/**
 * HTTP only. For the dashboard's Sales card.
 *
 *   GET /shop/sales/summary   (commerce:read)   ?days=30 -> { byCurrency, daily, ordersToFulfil }
 */
export async function salesRoutes(server: FastifyInstance, { shop }: { shop: ShopContext }) {
  server.get(
    "/shop/sales/summary",
    { preHandler: requirePermission("commerce:read") },
    async (request) => {
      const { days } = parseRequest(salesSummaryQuerySchema, request.query);
      return summariseSales(server.database, days, shop.now());
    },
  );
}
