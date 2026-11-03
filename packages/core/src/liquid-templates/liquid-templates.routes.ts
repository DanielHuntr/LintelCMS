import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/require-permission.js";
import { listTemplatesForEditor } from "./liquid-templates.service.js";

/**
 * HTTP only:
 *
 *   GET /website/liquid-templates  (entries:read)  -> { templates: [{ name, collectionHandle }] }
 *
 * The page templates in the templates folder, which the entry editor offers per page. Empty
 * when the install has none, and then the editor shows no choice.
 */
export async function liquidTemplatesRoutes(server: FastifyInstance) {
  server.get(
    "/website/liquid-templates",
    { preHandler: requirePermission("entries:read") },
    async () => listTemplatesForEditor(server.database, server.website.liquidTemplates),
  );
}
