/**
 * `@lintel/core/plugin`: everything the server half of a plugin needs, in one import.
 *
 *   import { definePlugin, requirePermission, tenantId } from "@lintel/core/plugin";
 *
 * Anything a plugin should rely on is exported here. The rest of core is internal and may
 * change without notice, so plugins shouldn't reach into it.
 */
export {
  definePlugin,
  type LintelConfig,
  type LintelPlugin,
  type PluginDatabase,
  type PluginDefinition,
  type PluginPermission,
  type PluginRouteContext,
  type PluginSettings,
} from "./plugin-definition.js";
export { requirePluginEnabled } from "./plugin-routes.js";
export { isPluginEnabled } from "./plugins.service.js";
export { PluginNotEnabledError } from "./plugins.errors.js";

/**
 * The Fastify server a plugin's `routes` add to. Re-exporting from server.ts also brings in
 * what Lintel adds to it, such as `server.database`.
 */
export type { FastifyInstance as PluginServer } from "fastify";
export type { ServerOptions } from "../server.js";

// Tables: the columns every Lintel table shares (see docs/decisions/0003).
export { DEFAULT_TENANT_ID, id, tenantId, timestamps } from "../database/columns.js";
export type { Database, DatabaseOrTransaction } from "../database/client.js";

// Routes: guards, request parsing and errors people can read.
export { getSignedIn, requirePermission, requireSignedIn } from "../auth/require-permission.js";
export type { SignedIn } from "../auth/auth.schema.js";
export { hasPermission, type Permission } from "../roles/permissions.js";
export {
  HttpError,
  InvalidFieldsError,
  InvalidRequestError,
  parseRequest,
  type FieldMessages,
} from "../http/http-errors.js";

// Blocks: offered in the builder while the plugin is on, defined as code blocks are.
export { defineBlock, type BlockDefinition, type BlockInput } from "../blocks/define-block.js";

// Fieldtypes: a plugin's kinds of field are defined exactly as core's own.
export {
  defineFieldtype,
  type FieldCheckContext,
  type Fieldtype,
  type FieldtypeDefinition,
} from "../fieldtypes/fieldtype.js";
