import type { FastifyInstance, FastifyRequest } from "fastify";
import { getSignedIn, requirePermission } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import { recordSecurityEvent, requestOrigin } from "../security-log/security-log.service.js";
import { RoleNotFoundError } from "./roles.errors.js";
import {
  createRoleRequestSchema,
  roleIdParamsSchema,
  updateRoleRequestSchema,
} from "./roles.schema.js";
import {
  createRole,
  deleteRole,
  listPermissionGroups,
  listRoles,
  updateRole,
} from "./roles.service.js";

/**
 * HTTP only:
 *
 *   GET    /roles        (users:read)    -> { roles: [Role] }
 *   GET    /permissions  (users:read)    -> { groups: [{ id, name, description, permissions }] }
 *   POST   /roles        (roles:update)  { name, description?, permissions, requiresTwoFactor? } -> 201
 *   PATCH  /roles/:id    (roles:update)  { name?, description?, permissions?, requiresTwoFactor? }
 *   DELETE /roles/:id    (roles:update)  -> 204
 */
export async function rolesRoutes(server: FastifyInstance) {
  const canRead = { preHandler: requirePermission("users:read") };
  const canUpdate = { preHandler: requirePermission("roles:update") };

  server.get("/roles", canRead, async () => ({ roles: await listRoles(server.database) }));

  server.get("/permissions", canRead, async () => ({
    groups: await listPermissionGroups(server.database),
  }));

  server.post("/roles", canUpdate, async (request, reply) => {
    const roleRequest = parseRequest(createRoleRequestSchema, request.body);
    const signedIn = getSignedIn(request);
    const role = await createRole(server.database, roleRequest, signedIn.permissions);
    await logRoleEvent(request, "role-created", role.name);
    return reply.code(201).send(role);
  });

  server.patch("/roles/:id", canUpdate, async (request) => {
    const roleId = readRoleId(request.params);
    const changes = parseRequest(updateRoleRequestSchema, request.body);
    const { after } = await updateRole(
      server.database,
      roleId,
      changes,
      getSignedIn(request).permissions,
    );
    await logRoleEvent(request, "role-updated", after.name);
    return after;
  });

  server.delete("/roles/:id", canUpdate, async (request, reply) => {
    const roleId = readRoleId(request.params);
    const role = await deleteRole(server.database, roleId);
    await logRoleEvent(request, "role-deleted", role.name);
    return reply.code(204).send();
  });
}

function readRoleId(params: unknown): string {
  const parsed = roleIdParamsSchema.safeParse(params);
  if (!parsed.success) {
    throw new RoleNotFoundError();
  }
  return parsed.data.id;
}

async function logRoleEvent(
  request: FastifyRequest,
  kind: "role-created" | "role-updated" | "role-deleted",
  roleName: string,
) {
  const { user } = getSignedIn(request);
  await recordSecurityEvent(request.server.database, {
    kind,
    actor: { id: user.id, email: user.email },
    origin: requestOrigin(request),
    details: { role: roleName },
  });
}
