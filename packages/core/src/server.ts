import cors from "@fastify/cors";
import Fastify from "fastify";
import { healthRoutes } from "./health/health.routes.js";

export interface ServerOptions {
  /** The admin app's address, allowed to call the API from the browser. */
  adminOrigin: string;
  /** Turn request logging off in tests to keep output readable. */
  logger?: boolean;
}

/**
 * Builds the API server without starting it. Tests call this directly and send
 * requests with `server.inject`; main.ts calls it and then starts listening.
 *
 * Every feature registers its routes here, in one visible list (no auto-discovery).
 */
export function buildServer(options: ServerOptions) {
  const server = Fastify({ logger: options.logger ?? false });

  server.register(cors, { origin: options.adminOrigin, credentials: true });

  server.register(healthRoutes);

  return server;
}
