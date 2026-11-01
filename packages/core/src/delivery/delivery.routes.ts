import type { FastifyInstance } from "fastify";
import { parseRequest } from "../http/http-errors.js";
import { PREVIEW_CACHE_CONTROL } from "../preview/preview.routes.js";
import { readPreviewToken } from "../preview/preview.service.js";
import { resolveDeliverySite } from "../sites/request-site.js";
import {
  deliveryEntryParamsSchema,
  deliveryEntryQuerySchema,
  deliveryListParamsSchema,
  deliveryListQuerySchema,
} from "./delivery.schema.js";
import { findDeliveredEntry, listDeliveredEntries } from "./delivery.service.js";
import { requireDeliveryAccess } from "./require-delivery-access.js";

/**
 * Websites may keep a response for a minute. Short enough that a publish shows up
 * quickly, long enough to take the load off the database for a busy page.
 */
const CACHE_CONTROL = "public, max-age=60";

/**
 * HTTP only. Public by design: no session, published content only (see README.md). When
 * the site is set to need a token, `requireDeliveryAccess` asks for one.
 *
 *   GET /delivery/:collection        ?page&perPage&locale&taxonomy&term
 *                                    -> { items: [DeliveredEntry], total }
 *   GET /delivery/:collection/:slug  ?locale&preview -> DeliveredEntry with translations, or 404
 *
 * With a preview token (`?preview=` or the `Lintel-Preview` header) for the entry at that
 * slug, its draft is served instead, never cached. A bad or expired token is a 401.
 *
 * Both answer for one site: `?site=<handle>`, the `Lintel-Site` header, or the domain the
 * request came to (see src/sites/request-site.ts).
 */
export async function deliveryRoutes(server: FastifyInstance) {
  const access = { preHandler: requireDeliveryAccess };

  server.get("/delivery/:collection", access, async (request, reply) => {
    const { collection } = parseRequest(deliveryListParamsSchema, request.params);
    const query = parseRequest(deliveryListQuerySchema, request.query);
    const site = await resolveDeliverySite(request, reply);
    const list = await listDeliveredEntries(
      server.database,
      collection,
      query,
      server.assetLookup,
      site,
    );
    return reply.header("cache-control", CACHE_CONTROL).send(list);
  });

  server.get("/delivery/:collection/:slug", access, async (request, reply) => {
    const { collection, slug } = parseRequest(deliveryEntryParamsSchema, request.params);
    const query = parseRequest(deliveryEntryQuerySchema, request.query);
    const header = request.headers["lintel-preview"];
    const token = query.preview ?? (typeof header === "string" && header !== "" ? header : null);
    const previewEntryId = token ? await readPreviewToken(server.database, token) : undefined;
    const site = await resolveDeliverySite(request, reply);

    const entry = await findDeliveredEntry(
      server.database,
      collection,
      slug,
      query.locale,
      server.assetLookup,
      previewEntryId,
      site,
    );
    // A preview request must not be cached even when it fell back to the published entry,
    // or the next visitor without a token could be served the same response.
    return reply
      .header("cache-control", previewEntryId ? PREVIEW_CACHE_CONTROL : CACHE_CONTROL)
      .send(entry);
  });
}
