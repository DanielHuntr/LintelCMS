import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requireDeliveryAccess } from "../../delivery/require-delivery-access.js";
import { parseRequest } from "../../http/http-errors.js";
import type { ShopContext } from "../commerce.context.js";
import {
  storefrontHandleParamsSchema,
  storefrontItemQuerySchema,
  storefrontListQuerySchema,
} from "./storefront.schema.js";
import {
  findStorefrontCollection,
  findStorefrontProduct,
  listStorefrontCollections,
  listStorefrontMarkets,
  listStorefrontProducts,
} from "./storefront.service.js";
import { ShopRecordNotFoundError } from "../commerce.errors.js";
import { isTestSession } from "../test-checkout/test-session.service.js";
import { TEST_SESSION_HEADER } from "../test-checkout/test-session-tokens.js";

/** Catalogue reads may be cached for a minute, like the delivery API. */
const CATALOGUE_CACHE = "public, max-age=60";

/**
 * HTTP only. The public shop API for websites, under /delivery/shop. The same access rules
 * as the delivery API apply (a token when the site requires one; CORS for listed sites).
 * Carts and checkout are in src/commerce/carts/carts.routes.ts.
 *
 *   GET    /delivery/shop/markets
 *   GET    /delivery/shop/products                      ?country&collection&page&perPage
 *   GET    /delivery/shop/products/:handle              ?country
 *   GET    /delivery/shop/collections
 *   GET    /delivery/shop/collections/:handle           ?country&page&perPage
 */
export async function storefrontRoutes(server: FastifyInstance, { shop }: { shop: ShopContext }) {
  const access = { preHandler: requireDeliveryAccess };

  /** A test session's answers are its own, so they are never kept by a shared cache. */
  const readVisit = async (request: FastifyRequest, reply: FastifyReply) => {
    const header = request.headers[TEST_SESSION_HEADER];
    const testSession = await isTestSession(shop, typeof header === "string" ? header : undefined);
    reply.header("cache-control", testSession ? "no-store" : CATALOGUE_CACHE);
    return { testSession };
  };

  server.get("/delivery/shop/markets", access, async (_request, reply) =>
    reply.header("cache-control", CATALOGUE_CACHE).send(await listStorefrontMarkets(shop)),
  );

  server.get("/delivery/shop/products", access, async (request, reply) => {
    const query = parseRequest(storefrontListQuerySchema, request.query);
    const visit = await readVisit(request, reply);
    return reply.send(await listStorefrontProducts(shop, query, visit));
  });

  server.get("/delivery/shop/products/:handle", access, async (request, reply) => {
    const { handle } = readHandle(request.params, "product");
    const { country } = parseRequest(storefrontItemQuerySchema, request.query);
    const visit = await readVisit(request, reply);
    return reply.send(await findStorefrontProduct(shop, handle, country, visit));
  });

  server.get("/delivery/shop/collections", access, async (_request, reply) =>
    reply.header("cache-control", CATALOGUE_CACHE).send(await listStorefrontCollections(shop)),
  );

  server.get("/delivery/shop/collections/:handle", access, async (request, reply) => {
    const { handle } = readHandle(request.params, "collection");
    const query = parseRequest(storefrontListQuerySchema, request.query);
    const visit = await readVisit(request, reply);
    return reply.send(await findStorefrontCollection(shop, handle, query, visit));
  });
}

function readHandle(params: unknown, thing: string): { handle: string } {
  const parsed = storefrontHandleParamsSchema.safeParse(params);
  if (!parsed.success) {
    throw new ShopRecordNotFoundError(thing);
  }
  return parsed.data;
}
