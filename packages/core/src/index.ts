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
export { HttpError, InvalidFieldsError, type FieldMessages } from "./http/http-errors.js";
export type { AssetExists, AssetLookup, DeliveredAsset } from "./fieldtypes/image-assets.js";
export type { BlueprintResponse } from "./blueprints/blueprints.schema.js";
export type { CollectionResponse } from "./collections/collections.schema.js";
export type {
  EntryListResponse,
  EntryResponse,
  EntrySummaryResponse,
  RevisionResponse,
  RevisionSummaryResponse,
} from "./entries/entries.schema.js";
export type { DeliveredEntry, DeliveredList } from "./delivery/delivery.schema.js";
export * from "./database/schema.js";
