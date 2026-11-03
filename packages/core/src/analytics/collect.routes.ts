import type { FastifyInstance } from "fastify";
import { parseRequest } from "../http/http-errors.js";
import { resolveDeliverySite } from "../sites/request-site.js";
import { analyticsScript } from "./analytics-script.js";
import { collectQuerySchema, collectRequestSchema } from "./analytics.schema.js";
import { recordVisitorEvent } from "./collection.service.js";

/** Events one address may send in a minute: plenty for a person, too few for a flood. */
const EVENTS_PER_MINUTE = 120;

/**
 * HTTP only. Public, like the rest of /delivery: the website's pages call these. The built-in
 * website serves them at its own address, /_lintel/api/analytics/* (see site-api.routes.ts).
 *
 *   GET  /delivery/analytics/script.js            the beacon (analytics-script.ts)
 *   POST /delivery/analytics/collect?site=<site>  one event, as JSON or plain text -> 204
 *
 * The answer is 204 whether the event was counted or not, so a page learns nothing about
 * how it was counted.
 */
export async function collectRoutes(server: FastifyInstance) {
  server.get("/delivery/analytics/script.js", async (_request, reply) =>
    reply
      .type("text/javascript; charset=utf-8")
      .header("cache-control", "public, max-age=3600")
      .header("cross-origin-resource-policy", "cross-origin")
      .send(analyticsScript),
  );

  server.post(
    "/delivery/analytics/collect",
    {
      bodyLimit: 8 * 1024,
      config: { rateLimit: { max: EVENTS_PER_MINUTE, timeWindow: "1 minute" } },
    },
    async (request, reply) => {
      parseRequest(collectQuerySchema, request.query);
      const report = parseRequest(collectRequestSchema, readBody(request.body));
      const site = await resolveDeliverySite(request, reply);
      await recordVisitorEvent(
        server.database,
        site,
        {
          ipAddress: request.ip,
          headers: request.headers,
        },
        report,
      );
      return reply.code(204).header("cache-control", "no-store").send();
    },
  );
}

/** `navigator.sendBeacon` sends plain text; `fetch` may send JSON. Either way it is JSON. */
function readBody(body: unknown): unknown {
  if (typeof body !== "string") return body;
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}
