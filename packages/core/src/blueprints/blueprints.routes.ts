import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import {
  blueprintHandleParamsSchema,
  createBlueprintRequestSchema,
  updateBlueprintRequestSchema,
} from "./blueprints.schema.js";
import {
  createBlueprint,
  deleteBlueprint,
  describeBlueprint,
  findBlueprintOrFail,
  listBlueprints,
  updateBlueprint,
} from "./blueprints.service.js";

/**
 * HTTP only:
 *
 *   GET    /blueprints          (blueprints:read)    -> { blueprints: [Blueprint] }
 *   GET    /blueprints/:handle  (blueprints:read)    -> Blueprint
 *   POST   /blueprints          (blueprints:update)  { handle, name, fields } -> 201 Blueprint
 *   PUT    /blueprints/:handle  (blueprints:update)  { name, fields } -> Blueprint, version + 1
 *   DELETE /blueprints/:handle  (blueprints:update)  -> 204, or 409 BLUEPRINT_IN_USE
 */
export async function blueprintsRoutes(server: FastifyInstance) {
  const canRead = { preHandler: requirePermission("blueprints:read") };
  const canUpdate = { preHandler: requirePermission("blueprints:update") };

  server.get("/blueprints", canRead, async () => listBlueprints(server.database));

  server.get("/blueprints/:handle", canRead, async (request) => {
    const { handle } = parseRequest(blueprintHandleParamsSchema, request.params);
    return describeBlueprint(await findBlueprintOrFail(server.database, handle));
  });

  server.post("/blueprints", canUpdate, async (request, reply) => {
    const blueprint = parseRequest(createBlueprintRequestSchema, request.body);
    return reply.code(201).send(await createBlueprint(server.database, blueprint));
  });

  server.put("/blueprints/:handle", canUpdate, async (request) => {
    const { handle } = parseRequest(blueprintHandleParamsSchema, request.params);
    const changes = parseRequest(updateBlueprintRequestSchema, request.body);
    return updateBlueprint(server.database, handle, changes);
  });

  server.delete("/blueprints/:handle", canUpdate, async (request, reply) => {
    const { handle } = parseRequest(blueprintHandleParamsSchema, request.params);
    await deleteBlueprint(server.database, handle);
    return reply.code(204).send();
  });
}
