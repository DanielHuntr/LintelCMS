import { loadConfig } from "./config.js";
import { createDatabase } from "./database/client.js";
import { buildServer } from "./server.js";

/**
 * Starts the API server. Run with `pnpm --filter @lintel/core dev`.
 */
const config = loadConfig();
const { database, close: closeDatabase } = createDatabase(config.DATABASE_URL);
const server = buildServer({
  adminOrigin: config.ADMIN_ORIGIN,
  database,
  // Local development usually runs over plain HTTP, where Secure cookies wouldn't be sent.
  secureCookies: config.NODE_ENV !== "development",
  logger: true,
});

server.addHook("onClose", async () => {
  await closeDatabase();
});

try {
  await server.listen({ port: config.API_PORT, host: "0.0.0.0" });
} catch (error) {
  server.log.error(error);
  process.exit(1);
}
