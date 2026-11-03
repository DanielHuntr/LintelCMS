import { dirname } from "node:path";
import type { FastifyInstance } from "fastify";
import { requirePermission } from "../auth/require-permission.js";
import { checkThisServer } from "./server-check.service.js";

/**
 * HTTP only. Looking at the server is for the people who look after the site, as updates
 * are (`updates:read`).
 *
 *   GET /system/server-check  (updates:read) -> { verdict, headline, checks, askHost }
 *
 * It takes a few seconds: it tries the internet and the database each time.
 */
export async function serverCheckRoutes(server: FastifyInstance) {
  server.get(
    "/system/server-check",
    { preHandler: requirePermission("updates:read") },
    async (_request, reply) => {
      const report = await checkThisServer({
        database: server.database,
        databaseKind: server.activeDatabase.kind,
        // The Lintel folder holds the data folder, uploads and resized pictures.
        folders: [dirname(server.lintelFolder.dataFolder), server.lintelFolder.dataFolder],
      });
      return reply.header("cache-control", "no-store").send(report);
    },
  );
}
