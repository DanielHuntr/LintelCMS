// The public surface of @lintel/core. Anything not exported here is internal.
export { buildServer, type ServerOptions } from "./server.js";
export { loadConfig, type Config } from "./config.js";
export { createDatabase, type Database } from "./database/client.js";
export { hasPermission, type Permission } from "./roles/permissions.js";
export { requirePermission, requireSignedIn, getSignedIn } from "./auth/require-permission.js";
export { SESSION_COOKIE_NAME } from "./auth/session-cookie.js";
export { signInRequestSchema, signedInSchema, type SignedIn } from "./auth/auth.schema.js";
export { HttpError } from "./http/http-errors.js";
export * from "./database/schema.js";
