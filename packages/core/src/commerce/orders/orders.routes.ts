import type { FastifyInstance } from "fastify";
import { getSignedIn, requirePermission } from "../../auth/require-permission.js";
import { parseRequest } from "../../http/http-errors.js";
import { readIdParam } from "../commerce-params.js";
import type { ShopContext } from "../commerce.context.js";
import { fulfilOrder } from "./fulfilments.service.js";
import {
  addOrderNoteRequestSchema,
  cancelOrderRequestSchema,
  fulfilOrderRequestSchema,
  listOrdersQuerySchema,
  refundOrderRequestSchema,
} from "./orders.schema.js";
import { addOrderNote, cancelOrder, findOrder, listOrders } from "./orders.service.js";
import { refundOrder } from "./refunds.service.js";

/**
 * HTTP only. Orders are made when a provider confirms a payment, never by a request here. Refunds and
 * cancelling move money, so they need `commerce:refund`.
 *
 *   GET  /shop/orders                   (commerce:read)    ?search&paymentStatus&fulfilmentStatus&cancelled&customerId&page&perPage
 *   GET  /shop/orders/:id               (commerce:read)    with lines, refunds, fulfilments and timeline
 *   POST /shop/orders/:id/fulfilments   (commerce:update)  { lines?, trackingCompany?, trackingNumber?, trackingUrl?, notifyCustomer? } -> 201 the order
 *   POST /shop/orders/:id/refunds       (commerce:refund)  { amount?, lines?, reason?, restock?, notifyCustomer? } -> 201 the order
 *   POST /shop/orders/:id/cancel        (commerce:refund)  { reason?, refund?, restock?, notifyCustomer? }
 *   POST /shop/orders/:id/notes         (commerce:update)  { message } -> 201 the order
 */
export async function ordersRoutes(server: FastifyInstance, { shop }: { shop: ShopContext }) {
  const read = { preHandler: requirePermission("commerce:read") };
  const update = { preHandler: requirePermission("commerce:update") };
  const refund = { preHandler: requirePermission("commerce:refund") };

  server.get("/shop/orders", read, async (request) => {
    const query = parseRequest(listOrdersQuerySchema, request.query);
    return listOrders(server.database, query);
  });

  server.get("/shop/orders/:id", read, async (request) =>
    findOrder(shop, readIdParam(request.params, "order")),
  );

  server.post("/shop/orders/:id/fulfilments", update, async (request, reply) => {
    const orderId = readIdParam(request.params, "order");
    const fulfilment = parseRequest(fulfilOrderRequestSchema, request.body);
    await fulfilOrder(shop, orderId, fulfilment, getSignedIn(request).user.id);
    return reply.code(201).send(await findOrder(shop, orderId));
  });

  server.post("/shop/orders/:id/refunds", refund, async (request, reply) => {
    const orderId = readIdParam(request.params, "order");
    const changes = parseRequest(refundOrderRequestSchema, request.body);
    await refundOrder(shop, orderId, changes, getSignedIn(request).user.id);
    return reply.code(201).send(await findOrder(shop, orderId));
  });

  server.post("/shop/orders/:id/cancel", refund, async (request) => {
    const cancel = parseRequest(cancelOrderRequestSchema, request.body ?? {});
    return cancelOrder(
      shop,
      readIdParam(request.params, "order"),
      cancel,
      getSignedIn(request).user.id,
    );
  });

  server.post("/shop/orders/:id/notes", update, async (request, reply) => {
    const { message } = parseRequest(addOrderNoteRequestSchema, request.body);
    const order = await addOrderNote(
      shop,
      readIdParam(request.params, "order"),
      message,
      getSignedIn(request).user.id,
    );
    return reply.code(201).send(order);
  });
}
