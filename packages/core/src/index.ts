// The public surface of @lintel/core. Anything not exported here is internal.
export { buildServer, type ServerOptions } from "./server.js";
export { loadConfig, type Config } from "./config.js";
export type { Database, DatabaseKind, OpenedDatabase } from "./database/client.js";
export { ActiveDatabase, openStartupDatabase } from "./database/active-database.js";
export { openBuiltInDatabase } from "./database/built-in-database.js";
export { connectToPostgres } from "./database/postgres-database.js";
export { pluginRegistry, type PluginId } from "./plugins/plugins.registry.js";
export { setupStatusSchema, type SetupStatus } from "./setup/setup.schema.js";
export { hasPermission, type Permission } from "./roles/permissions.js";
export { requirePermission, requireSignedIn, getSignedIn } from "./auth/require-permission.js";
export { SESSION_COOKIE_NAME } from "./auth/session-cookie.js";
export { signInRequestSchema, signedInSchema, type SignedIn } from "./auth/auth.schema.js";
export { HttpError } from "./http/http-errors.js";
export * from "./database/schema.js";
