import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/require-permission.js";
import { resolveEditingSite } from "../sites/request-site.js";
import { deleteShader, readShaderLibrary, saveShader } from "./custom-shaders.service.js";

/**
 * HTTP only, for the site being edited (the `Lintel-Site` header). Anyone who designs pages
 * can see and use the site's shaders; writing them takes both design and code permissions.
 *
 *   GET    /website/shaders      (builder:design)              -> { shaders, allowed }
 *   PUT    /website/shaders/:id  (builder:design, builder:code) { name, code } -> the shader
 *   DELETE /website/shaders/:id  (builder:design, builder:code)
 */
export async function customShadersRoutes(server: FastifyInstance) {
  const writes = {
    preHandler: [requirePermission("builder:design"), requirePermission("builder:code")],
  };

  server.get(
    "/website/shaders",
    { preHandler: requirePermission("builder:design") },
    async (request) => readShaderLibrary(server.database, await resolveEditingSite(request)),
  );

  server.put<{ Params: { id: string } }>("/website/shaders/:id", writes, async (request) =>
    saveShader(server.database, await resolveEditingSite(request), request.params.id, request.body),
  );

  server.delete<{ Params: { id: string } }>(
    "/website/shaders/:id",
    writes,
    async (request, reply) => {
      await deleteShader(server.database, await resolveEditingSite(request), request.params.id);
      return reply.code(204).send();
    },
  );
}
