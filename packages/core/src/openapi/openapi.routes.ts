import type { FastifyInstance } from "fastify";
import { buildOpenApiDocument, type OpenApiDocument } from "./openapi-document.js";
import { openApiOperations } from "./openapi-operations.js";

/**
 * HTTP only:
 *
 *   GET /openapi.json  (public)  -> the OpenAPI 3.1 document for the REST API
 *
 * Public, like any API's documentation; it describes endpoints, not content. Built once,
 * the first time it is asked for, since it only changes when the code does.
 */
export async function openApiRoutes(server: FastifyInstance) {
  let document: OpenApiDocument | undefined;

  server.get("/openapi.json", async (_request, reply) => {
    document ??= buildOpenApiDocument(openApiOperations, server.publicApiUrl);
    return reply.header("cache-control", "public, max-age=300").send(document);
  });
}
