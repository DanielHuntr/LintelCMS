import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/require-permission.js";
import { parseRequest } from "../http/http-errors.js";
import {
  createFieldsetRequestSchema,
  fieldsetParamsSchema,
  updateFieldsetRequestSchema,
} from "./fieldsets.schema.js";
import {
  createFieldset,
  deleteFieldset,
  findFieldset,
  listFieldsets,
  updateFieldset,
} from "./fieldsets.service.js";

/**
 * HTTP only. Fieldsets are part of the content model, so they need the same permissions as
 * content types.
 *
 *   GET    /fieldsets           (blueprints:read)    -> { fieldsets: [Fieldset] }
 *   POST   /fieldsets           (blueprints:update)  { handle, name, fields? } -> 201 Fieldset
 *   GET    /fieldsets/:handle   (blueprints:read)    -> Fieldset
 *   PUT    /fieldsets/:handle   (blueprints:update)  { name, fields } -> Fieldset
 *   DELETE /fieldsets/:handle   (blueprints:update)  -> 204, or 409 FIELDSET_IN_USE
 */
export async function fieldsetsRoutes(server: FastifyInstance) {
  const canRead = { preHandler: requirePermission("blueprints:read") };
  const canChange = { preHandler: requirePermission("blueprints:update") };

  server.get("/fieldsets", canRead, async () => listFieldsets(server.database));

  server.post("/fieldsets", canChange, async (request, reply) => {
    const fieldset = parseRequest(createFieldsetRequestSchema, request.body);
    return reply.code(201).send(await createFieldset(server.database, fieldset));
  });

  server.get("/fieldsets/:handle", canRead, async (request) => {
    const { handle } = parseRequest(fieldsetParamsSchema, request.params);
    return findFieldset(server.database, handle);
  });

  server.put("/fieldsets/:handle", canChange, async (request) => {
    const { handle } = parseRequest(fieldsetParamsSchema, request.params);
    const changes = parseRequest(updateFieldsetRequestSchema, request.body);
    return updateFieldset(server.database, handle, changes);
  });

  server.delete("/fieldsets/:handle", canChange, async (request, reply) => {
    const { handle } = parseRequest(fieldsetParamsSchema, request.params);
    await deleteFieldset(server.database, handle);
    return reply.code(204).send();
  });
}
