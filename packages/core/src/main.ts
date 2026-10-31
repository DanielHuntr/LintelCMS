import { loadConfig } from "./config.js";
import { buildServer } from "./server.js";

/**
 * Starts the API server. Run with `pnpm --filter @lintel/core dev`.
 */
const config = loadConfig();
const server = buildServer({ adminOrigin: config.ADMIN_ORIGIN, logger: true });

try {
  await server.listen({ port: config.API_PORT, host: "0.0.0.0" });
} catch (error) {
  server.log.error(error);
  process.exit(1);
}
