import type { FastifyInstance, FastifyRequest } from "fastify";
import { getSignedIn, requirePermission } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import type {
  SecurityEventDetails,
  SecurityEventKind,
} from "../security-log/security-events.table.js";
import { recordSecurityEvent, requestOrigin } from "../security-log/security-log.service.js";
import {
  changeUserRole,
  deactivateUser,
  getUser,
  listUsers,
  reactivateUser,
  removeUser,
} from "./user-management.service.js";
import { UserNotFoundHttpError } from "./users.errors.js";
import {
  changeUserRoleRequestSchema,
  listUsersQuerySchema,
  removeUserRequestSchema,
  userIdParamsSchema,
} from "./users.schema.js";
import type { User } from "./users.table.js";

/**
 * HTTP only:
 *
 *   GET    /users                 (users:read)    ?search -> { users: [UserListItem] }
 *   GET    /users/:id             (users:read)    -> UserListItem
 *   PUT    /users/:id/role        (users:update)  { roleId } -> UserListItem
 *   POST   /users/:id/deactivate  (users:update)  -> UserListItem, and signs them out
 *   POST   /users/:id/reactivate  (users:update)  -> UserListItem
 *   DELETE /users/:id             (users:delete)  { reassignToUserId } -> 204
 */
export async function usersRoutes(server: FastifyInstance) {
  const canRead = { preHandler: requirePermission("users:read") };
  const canUpdate = { preHandler: requirePermission("users:update") };
  const canDelete = { preHandler: requirePermission("users:delete") };

  server.get("/users", canRead, async (request) => {
    const query = parseRequest(listUsersQuerySchema, request.query);
    return { users: await listUsers(server.database, query, server.publicApiUrl) };
  });

  server.get("/users/:id", canRead, async (request) =>
    getUser(server.database, readUserId(request.params), server.publicApiUrl),
  );

  server.put("/users/:id/role", canUpdate, async (request) => {
    const { roleId } = parseRequest(changeUserRoleRequestSchema, request.body);
    const change = await changeUserRole(
      server.database,
      getSignedIn(request),
      readUserId(request.params),
      roleId,
    );
    await logUserEvent(request, "role-changed", change.user, {
      from: change.from.join(", "),
      to: change.to.name,
    });
    return getUser(server.database, change.user.id, server.publicApiUrl);
  });

  server.post("/users/:id/deactivate", canUpdate, async (request) => {
    const user = await deactivateUser(
      server.database,
      getSignedIn(request),
      readUserId(request.params),
    );
    await logUserEvent(request, "user-deactivated", user);
    return getUser(server.database, user.id, server.publicApiUrl);
  });

  server.post("/users/:id/reactivate", canUpdate, async (request) => {
    const user = await reactivateUser(
      server.database,
      getSignedIn(request),
      readUserId(request.params),
    );
    await logUserEvent(request, "user-reactivated", user);
    return getUser(server.database, user.id, server.publicApiUrl);
  });

  server.delete("/users/:id", canDelete, async (request, reply) => {
    const { reassignToUserId } = parseRequest(removeUserRequestSchema, request.body ?? {});
    const removed = await removeUser(
      server.database,
      getSignedIn(request),
      readUserId(request.params),
      reassignToUserId,
    );
    await logUserEvent(request, "user-removed", removed.user, {
      email: removed.user.email,
      contentMovedTo: removed.reassignedTo.name,
      entriesMoved: removed.reassignedEntries,
    });
    return reply.code(204).send();
  });
}

function readUserId(params: unknown): string {
  const parsed = userIdParamsSchema.safeParse(params);
  if (!parsed.success) {
    throw new UserNotFoundHttpError();
  }
  return parsed.data.id;
}

async function logUserEvent(
  request: FastifyRequest,
  kind: SecurityEventKind,
  subject: User,
  details: SecurityEventDetails = {},
) {
  const { user } = getSignedIn(request);
  await recordSecurityEvent(request.server.database, {
    kind,
    actor: { id: user.id, email: user.email },
    // A removed person's id no longer exists; their name is kept in the log instead.
    subject: { id: kind === "user-removed" ? null : subject.id, name: subject.name },
    origin: requestOrigin(request),
    details,
  });
}
