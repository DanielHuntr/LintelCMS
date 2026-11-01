import type { FastifyInstance } from "fastify";
import { requirePermission } from "../../auth/require-permission.js";
import { parseRequest } from "../../http/http-errors.js";
import { readIdParam } from "../commerce-params.js";
import { listCustomersQuerySchema, updateCustomerRequestSchema } from "./customers.schema.js";
import { findCustomer, listCustomers, updateCustomer } from "./customers.service.js";

/**
 * HTTP only. A customer's orders come from `GET /shop/orders?customerId=`.
 *
 *   GET   /shop/customers       (commerce:read)    ?search&page&perPage -> { items, total }
 *   GET   /shop/customers/:id   (commerce:read)
 *   PATCH /shop/customers/:id   (commerce:update)  { name?, phone?, note? }
 */
export async function customersRoutes(server: FastifyInstance) {
  const read = { preHandler: requirePermission("commerce:read") };
  const update = { preHandler: requirePermission("commerce:update") };

  server.get("/shop/customers", read, async (request) => {
    const query = parseRequest(listCustomersQuerySchema, request.query);
    return listCustomers(server.database, query);
  });

  server.get("/shop/customers/:id", read, async (request) =>
    findCustomer(server.database, readIdParam(request.params, "customer")),
  );

  server.patch("/shop/customers/:id", update, async (request) => {
    const changes = parseRequest(updateCustomerRequestSchema, request.body);
    return updateCustomer(server.database, readIdParam(request.params, "customer"), changes);
  });
}
