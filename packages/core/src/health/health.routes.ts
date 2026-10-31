import type { FastifyInstance } from "fastify";

/**
 * GET /health tells load balancers and uptime checks that the server is running.
 * It deliberately does not touch the database, so a slow database doesn't make
 * the whole server look dead.
 */
export async function healthRoutes(server: FastifyInstance) {
  server.get("/health", async () => ({ status: "ok" }));
}
