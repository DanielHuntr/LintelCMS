import type { FastifyInstance } from "fastify";
import { requireDeliveryAccess } from "../../delivery/require-delivery-access.js";
import { parseRequest } from "../../http/http-errors.js";
import { startCheckoutRequestSchema } from "../checkouts/checkouts.schema.js";
import { findCheckoutStatus, startCheckout } from "../checkouts/checkouts.service.js";
import { readIdParam } from "../commerce-params.js";
import type { ShopContext } from "../commerce.context.js";
import { CartNotFoundError } from "./carts.errors.js";
import {
  addCartLineRequestSchema,
  cartTokenParamsSchema,
  createCartRequestSchema,
  updateCartLineRequestSchema,
  updateCartRequestSchema,
} from "./carts.schema.js";
import {
  addCartLine,
  createCart,
  findCart,
  listCartShippingRates,
  updateCart,
  updateCartLine,
} from "./carts.service.js";

/** Carts change with every click, so no answer here may be cached. */
const NO_STORE = "no-store";

/**
 * HTTP only. The storefront's cart and checkout, under /delivery/shop with the delivery
 * API's access rules. The token from `POST /delivery/shop/carts` opens the cart.
 *
 *   POST   /delivery/shop/carts                         { country? } -> 201 { token, cart }
 *   GET    /delivery/shop/carts/:token
 *   PATCH  /delivery/shop/carts/:token                  { email?, country?, shippingAddress?, shippingRateId?, discountCodes? }
 *   POST   /delivery/shop/carts/:token/lines            { variantId, quantity? }
 *   PATCH  /delivery/shop/carts/:token/lines/:lineId    { quantity } (0 removes)
 *   DELETE /delivery/shop/carts/:token/lines/:lineId
 *   GET    /delivery/shop/carts/:token/shipping-rates
 *   POST   /delivery/shop/carts/:token/checkout         { successUrl?, cancelUrl? } -> 201
 *   GET    /delivery/shop/checkouts/:id                 -> { status, orderName }
 */
export async function cartsRoutes(server: FastifyInstance, { shop }: { shop: ShopContext }) {
  const access = { preHandler: requireDeliveryAccess };

  server.post("/delivery/shop/carts", access, async (request, reply) => {
    const cart = parseRequest(createCartRequestSchema, request.body ?? {});
    return reply
      .code(201)
      .header("cache-control", NO_STORE)
      .send(await createCart(shop, cart));
  });

  server.get("/delivery/shop/carts/:token", access, async (request, reply) =>
    reply.header("cache-control", NO_STORE).send(await findCart(shop, readToken(request.params))),
  );

  server.patch("/delivery/shop/carts/:token", access, async (request, reply) => {
    const changes = parseRequest(updateCartRequestSchema, request.body);
    return reply
      .header("cache-control", NO_STORE)
      .send(await updateCart(shop, readToken(request.params), changes));
  });

  server.post("/delivery/shop/carts/:token/lines", access, async (request, reply) => {
    const line = parseRequest(addCartLineRequestSchema, request.body);
    return reply
      .header("cache-control", NO_STORE)
      .send(await addCartLine(shop, readToken(request.params), line));
  });

  server.patch("/delivery/shop/carts/:token/lines/:lineId", access, async (request, reply) => {
    const { quantity } = parseRequest(updateCartLineRequestSchema, request.body);
    const lineId = readIdParam(request.params, "cart item", "lineId");
    return reply
      .header("cache-control", NO_STORE)
      .send(await updateCartLine(shop, readToken(request.params), lineId, quantity));
  });

  server.delete("/delivery/shop/carts/:token/lines/:lineId", access, async (request, reply) => {
    const lineId = readIdParam(request.params, "cart item", "lineId");
    return reply
      .header("cache-control", NO_STORE)
      .send(await updateCartLine(shop, readToken(request.params), lineId, 0));
  });

  server.get("/delivery/shop/carts/:token/shipping-rates", access, async (request, reply) =>
    reply
      .header("cache-control", NO_STORE)
      .send(await listCartShippingRates(shop, readToken(request.params))),
  );

  server.post("/delivery/shop/carts/:token/checkout", access, async (request, reply) => {
    const pages = parseRequest(startCheckoutRequestSchema, request.body ?? {});
    const started = await startCheckout(shop, readToken(request.params), pages);
    return reply.code(201).header("cache-control", NO_STORE).send(started);
  });

  server.get("/delivery/shop/checkouts/:id", access, async (request, reply) =>
    reply
      .header("cache-control", NO_STORE)
      .send(await findCheckoutStatus(shop, readIdParam(request.params, "checkout"))),
  );
}

function readToken(params: unknown): string {
  const parsed = cartTokenParamsSchema.safeParse(params);
  if (!parsed.success) {
    throw new CartNotFoundError();
  }
  return parsed.data.token;
}
