import type { FastifyInstance } from "fastify";
import { requirePermission } from "../../auth/require-permission.js";
import { parseRequest } from "../../http/http-errors.js";
import { readIdParam } from "../commerce-params.js";
import type { ShopContext } from "../commerce.context.js";
import { listProductsQuerySchema, productRequestSchema } from "./products.schema.js";
import {
  createProduct,
  deleteProduct,
  findProduct,
  listProducts,
  updateProduct,
} from "./products.service.js";

/**
 * HTTP only. The storefront's read-only product endpoints are in src/commerce/storefront.
 *
 *   GET    /shop/products        (commerce:read)    ?search&status&page&perPage -> { items, total }
 *   POST   /shop/products        (commerce:update)  the whole product -> 201
 *   GET    /shop/products/:id    (commerce:read)
 *   PUT    /shop/products/:id    (commerce:update)  the whole product, variants included
 *   DELETE /shop/products/:id    (commerce:update)  -> 204
 */
export async function productsRoutes(server: FastifyInstance, { shop }: { shop: ShopContext }) {
  const read = { preHandler: requirePermission("commerce:read") };
  const update = { preHandler: requirePermission("commerce:update") };

  server.get("/shop/products", read, async (request) => {
    const query = parseRequest(listProductsQuerySchema, request.query);
    return listProducts(server.database, query, shop.now());
  });

  server.post("/shop/products", update, async (request, reply) => {
    const product = parseRequest(productRequestSchema, request.body);
    const created = await createProduct(server.database, product, server.assetExists, shop.now());
    return reply.code(201).send(created);
  });

  server.get("/shop/products/:id", read, async (request) =>
    findProduct(server.database, readIdParam(request.params, "product"), shop.now()),
  );

  server.put("/shop/products/:id", update, async (request) => {
    const product = parseRequest(productRequestSchema, request.body);
    return updateProduct(
      server.database,
      readIdParam(request.params, "product"),
      product,
      server.assetExists,
      shop.now(),
    );
  });

  server.delete("/shop/products/:id", update, async (request, reply) => {
    await deleteProduct(server.database, readIdParam(request.params, "product"));
    return reply.code(204).send();
  });
}
