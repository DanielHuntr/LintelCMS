import type { FastifyInstance } from "fastify";
import { getSignedIn, requirePermission } from "../../auth/require-permission.js";
import { parseRequest } from "../../http/http-errors.js";
import { readIdParam } from "../commerce-params.js";
import type { ShopContext } from "../commerce.context.js";
import { listArchivedOrders } from "./archived-orders.service.js";
import {
  importOptionsSchema,
  listArchivedOrdersQuerySchema,
  runImportRequestSchema,
  startImportRequestSchema,
} from "./shopify-import.schema.js";
import {
  dryRunImport,
  findImport,
  listImports,
  runImportBatch,
  startImport,
  updateImportOptions,
} from "./shopify-import.service.js";

/** Shopify's exports run large; their JSON-escaped text needs room. */
const IMPORT_BODY_LIMIT = 80 * 1024 * 1024;

/**
 * HTTP only:
 *
 *   POST /shop/imports/shopify          (commerce:update)  { productsCsv, customersCsv?, ordersCsv? } -> 201
 *   GET  /shop/imports                  (commerce:read)    -> { imports }
 *   GET  /shop/imports/:id              (commerce:read)    preview, mapping, progress, report
 *   PUT  /shop/imports/:id/options      (commerce:update)  the mapping screen's choices
 *   POST /shop/imports/:id/dry-run      (commerce:update)  every check, nothing saved
 *   POST /shop/imports/:id/run          (commerce:update)  { maxItems? } a few seconds' work; call until completed
 *   GET  /shop/archived-orders          (commerce:read)    ?customerId=&page=&perPage=
 */
export async function shopifyImportRoutes(
  server: FastifyInstance,
  { shop }: { shop: ShopContext },
) {
  const read = { preHandler: requirePermission("commerce:read") };
  const update = { preHandler: requirePermission("commerce:update") };
  const people = (userId: string) => ({ userId, assetExists: server.assetExists });

  server.post(
    "/shop/imports/shopify",
    { ...update, bodyLimit: IMPORT_BODY_LIMIT },
    async (request, reply) => {
      const files = parseRequest(startImportRequestSchema, request.body);
      const started = await startImport(shop, files, getSignedIn(request).user.id);
      return reply.code(201).send(started);
    },
  );

  server.get("/shop/imports", read, async () => listImports(shop));

  server.get("/shop/imports/:id", read, async (request) =>
    findImport(shop, readIdParam(request.params, "import")),
  );

  server.put("/shop/imports/:id/options", update, async (request) =>
    updateImportOptions(
      shop,
      readIdParam(request.params, "import"),
      parseRequest(importOptionsSchema, request.body),
    ),
  );

  server.post("/shop/imports/:id/dry-run", update, async (request) =>
    dryRunImport(shop, readIdParam(request.params, "import"), people(getSignedIn(request).user.id)),
  );

  server.post("/shop/imports/:id/run", update, async (request) => {
    const { maxItems } = parseRequest(runImportRequestSchema, request.body ?? {});
    return runImportBatch(
      shop,
      readIdParam(request.params, "import"),
      people(getSignedIn(request).user.id),
      maxItems,
    );
  });

  server.get("/shop/archived-orders", read, async (request) =>
    listArchivedOrders(shop.database, parseRequest(listArchivedOrdersQuerySchema, request.query)),
  );
}
