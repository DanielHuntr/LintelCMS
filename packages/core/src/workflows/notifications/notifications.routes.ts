import type { FastifyInstance } from "fastify";
import { getSignedIn, requireSignedIn } from "../../auth/require-permission.js";
import { parseRequest } from "../../http/http-errors.js";
import { notificationIdParamsSchema } from "../workflows.schema.js";
import { listNotifications, markRead } from "./notifications.service.js";

/**
 * HTTP only. Everyone signed in sees only their own notifications:
 *
 *   GET  /notifications                        { unread, notifications }
 *   POST /notifications/read-all               -> 204
 *   POST /notifications/:notificationId/read   -> 204
 */
export async function notificationsRoutes(server: FastifyInstance) {
  const signedIn = { preHandler: requireSignedIn };

  server.get("/notifications", signedIn, async (request) =>
    listNotifications(server.database, getSignedIn(request).user.id),
  );

  server.post("/notifications/read-all", signedIn, async (request, reply) => {
    await markRead(server.database, getSignedIn(request).user.id);
    return reply.code(204).send();
  });

  server.post("/notifications/:notificationId/read", signedIn, async (request, reply) => {
    const { notificationId } = parseRequest(notificationIdParamsSchema, request.params);
    await markRead(server.database, getSignedIn(request).user.id, notificationId);
    return reply.code(204).send();
  });
}
