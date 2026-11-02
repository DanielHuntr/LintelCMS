import type { FastifyInstance } from "fastify";
import {
  getSignedIn,
  requireAccountSession,
  requirePermission,
  requireSignedIn,
} from "../auth/require-permission.js";
import { describeOutboxFor } from "./outbox.service.js";

/**
 * HTTP only:
 *
 *   GET /email/status  (signed in)  -> { delivers }
 *   GET /email/outbox  (owners, signed in with a browser)
 *     -> { enabled, messages: [{ id, to, subject, text, sentAt }] }
 *
 * The messages hold sign-in links, so an API token can't read them, and secret links sent to
 * other people are hidden (see outbox.service.ts).
 */
export async function emailRoutes(server: FastifyInstance) {
  // Whether emails really go out, so screens that send email can warn when they won't
  // (form notifications, say). Says nothing about the service or its settings.
  server.get("/email/status", { preHandler: requireSignedIn }, async () => ({
    delivers: server.emailOutbox === null,
  }));

  server.get(
    "/email/outbox",
    { preHandler: [requireAccountSession, requirePermission("settings:read")] },
    async (request, reply) =>
      // Nothing in between should keep a copy of the links.
      reply
        .header("cache-control", "no-store")
        .send(await describeOutboxFor(server, getSignedIn(request))),
  );
}
