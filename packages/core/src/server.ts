import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { authRoutes } from "./auth/auth.routes.js";
import type { Database } from "./database/client.js";
import { healthRoutes } from "./health/health.routes.js";

declare module "fastify" {
  interface FastifyInstance {
    /** The database every route and guard uses, passed in to `buildServer`. */
    database: Database;
    /** Whether cookies are marked Secure (HTTPS only). Off only in development. */
    secureCookies: boolean;
  }
}

export interface ServerOptions {
  /** The admin app's address, allowed to call the API from the browser. */
  adminOrigin: string;
  /**
   * Passed in rather than created here, so tests can hand over a test database.
   * The connection opens on the first query, so routes like /health never touch it.
   */
  database: Database;
  /** Mark cookies Secure. Turn off only for plain-HTTP local development. */
  secureCookies?: boolean;
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

  server.decorate("database", options.database);
  server.decorate("secureCookies", options.secureCookies ?? true);
  server.decorateRequest("signedIn", null);

  server.register(cors, { origin: options.adminOrigin, credentials: true });
  server.register(cookie);
  // Off by default; routes that need a limit (like sign-in) set their own.
  server.register(rateLimit, { global: false });

  server.register(healthRoutes);
  server.register(authRoutes);

  return server;
}
