import type { FastifyInstance } from "fastify";
import { requirePermission } from "../../auth/require-permission.js";
import { parseRequest } from "../../http/http-errors.js";
import { readIdParam } from "../commerce-params.js";
import type { ShopContext } from "../commerce.context.js";
import { discountRequestSchema } from "./discounts.schema.js";
import {
  createDiscount,
  deleteDiscount,
  findDiscount,
  listDiscounts,
  updateDiscount,
} from "./discounts.service.js";

/**
 * HTTP only:
 *
 *   GET    /shop/discounts        (commerce:read)    -> { discounts }
 *   POST   /shop/discounts        (commerce:update)  the whole discount -> 201
 *   GET    /shop/discounts/:id    (commerce:read)
 *   PUT    /shop/discounts/:id    (commerce:update)  the whole discount
 *   DELETE /shop/discounts/:id    (commerce:update)  -> 204
 */
export async function discountsRoutes(server: FastifyInstance, { shop }: { shop: ShopContext }) {
  const read = { preHandler: requirePermission("commerce:read") };
  const update = { preHandler: requirePermission("commerce:update") };

  server.get("/shop/discounts", read, async () => listDiscounts(shop.database, shop.now()));

  server.post("/shop/discounts", update, async (request, reply) => {
    const discount = parseRequest(discountRequestSchema, request.body);
    return reply.code(201).send(await createDiscount(shop.database, discount, shop.now()));
  });

  server.get("/shop/discounts/:id", read, async (request) =>
    findDiscount(shop.database, readIdParam(request.params, "discount"), shop.now()),
  );

  server.put("/shop/discounts/:id", update, async (request) => {
    const discount = parseRequest(discountRequestSchema, request.body);
    return updateDiscount(
      shop.database,
      readIdParam(request.params, "discount"),
      discount,
      shop.now(),
    );
  });

  server.delete("/shop/discounts/:id", update, async (request, reply) => {
    await deleteDiscount(shop.database, readIdParam(request.params, "discount"));
    return reply.code(204).send();
  });
}
