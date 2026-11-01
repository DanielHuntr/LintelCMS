import type { FastifyInstance } from "fastify";
import type { StorageDriver } from "../media/index.js";
import { checkReadiness } from "./readiness.service.js";

export interface HealthRoutesOptions {
  storage: StorageDriver;
}

/**
 * GET /health tells uptime checks that the server is running. It deliberately touches
 * nothing else, so a slow database doesn't make the whole server look dead.
 *
 * GET /ready tells load balancers and deploys whether the server can serve requests: 200
 * when the database, its tables and storage are all fine, 503 otherwise. It also says 503
 * while the server is shutting down (Fastify does that for every request then).
 */
export async function healthRoutes(server: FastifyInstance, options: HealthRoutesOptions) {
  server.get("/health", async () => ({ status: "ok" }));

  server.get("/ready", async (request, reply) => {
    const report = await checkReadiness({ database: server.database, storage: options.storage });
    if (!report.ready) {
      request.log.warn({ problems: report.problems }, "Not ready to serve requests");
    }
    return reply
      .code(report.ready ? 200 : 503)
      .header("cache-control", "no-store")
      .send({ status: report.ready ? "ready" : "not ready", checks: report.checks });
  });
}
