import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/require-permission.js";
import { describeOutbox } from "./email.service.js";

/**
 * HTTP only:
 *
 *   GET /email/outbox  (settings:read)  -> { enabled, messages: [{ id, to, subject, text, sentAt }] }
 */
export async function emailRoutes(server: FastifyInstance) {
  server.get(
    "/email/outbox",
    { preHandler: requirePermission("settings:read") },
    async (_, reply) =>
      // The messages hold sign-in links; nothing in between should keep a copy.
      reply.header("cache-control", "no-store").send(describeOutbox(server.emailOutbox)),
  );
}
