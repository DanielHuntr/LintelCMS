import type { FastifyInstance } from "fastify";
import { parseRequest } from "../http/http-errors.js";
import { PREVIEW_CACHE_CONTROL } from "../preview/preview.routes.js";
import { readPreviewToken } from "../preview/preview.service.js";
import {
  deliveryEntryParamsSchema,
  deliveryEntryQuerySchema,
  deliveryListParamsSchema,
  deliveryListQuerySchema,
} from "./delivery.schema.js";
import { findDeliveredEntry, listDeliveredEntries } from "./delivery.service.js";

/**
 * Websites may keep a response for a minute. Short enough that a publish shows up
 * quickly, long enough to take the load off the database for a busy page.
 */
const CACHE_CONTROL = "public, max-age=60";

/**
 * HTTP only. Public by design: no session, published content only (see README.md).
 *
 *   GET /delivery/:collection        ?page&perPage -> { items: [DeliveredEntry], total }
 *   GET /delivery/:collection/:slug  ?preview -> DeliveredEntry, or 404
 *
 * With a preview token (`?preview=` or the `Lintel-Preview` header) for the entry at that
 * slug, its draft is served instead, never cached. A bad or expired token is a 401.
 */
export async function deliveryRoutes(server: FastifyInstance) {
  server.get("/delivery/:collection", async (request, reply) => {
    const { collection } = parseRequest(deliveryListParamsSchema, request.params);
    const query = parseRequest(deliveryListQuerySchema, request.query);
    const list = await listDeliveredEntries(server.database, collection, query, server.assetLookup);
    return reply.header("cache-control", CACHE_CONTROL).send(list);
  });

  server.get("/delivery/:collection/:slug", async (request, reply) => {
    const { collection, slug } = parseRequest(deliveryEntryParamsSchema, request.params);
    const query = parseRequest(deliveryEntryQuerySchema, request.query);
    const header = request.headers["lintel-preview"];
    const token = query.preview ?? (typeof header === "string" && header !== "" ? header : null);
    const previewEntryId = token ? await readPreviewToken(server.database, token) : undefined;

    const entry = await findDeliveredEntry(
      server.database,
      collection,
      slug,
      server.assetLookup,
      previewEntryId,
    );
    // A preview request must not be cached even when it fell back to the published entry,
    // or the next visitor without a token could be served the same response.
    return reply
      .header("cache-control", previewEntryId ? PREVIEW_CACHE_CONTROL : CACHE_CONTROL)
      .send(entry);
  });
}
