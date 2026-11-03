import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, tenantId, timestamps } from "../database/columns.js";
import { usersTable } from "../users/users.table.js";
import type { AppManifest } from "./app-manifest.schema.js";
import type { AppScope } from "./app-scopes.js";

/**
 * An installed app: a program that runs on its own server, in any language, and uses
 * Lintel through the API, webhooks and frames in the admin.
 *
 * - `manifest` is the copy the installer approved. The app's live `lintel-app.json` is not
 *   read again, so it can't widen its own access.
 * - `clientSecret` is kept as it is, like a webhook's secret, because Lintel signs session
 *   tokens and webhooks with it. `clientSecretHash` finds the app from a request without
 *   comparing secrets. Neither is ever sent back after installing.
 * - The app acts for the person who installed it (revisions show their name) and never has
 *   more access than they do. Deleting their account uninstalls their apps.
 *
 * Webhooks the app subscribed to point back here (`webhooks.app_id`), so uninstalling
 * deletes them, and their delivery log, in the same statement.
 */
export const appsTable = pgTable(
  "apps",
  {
    id: id(),
    tenantId: tenantId(),
    handle: text("handle").notNull(),
    name: text("name").notNull(),
    manifest: jsonb("manifest").$type<AppManifest>().notNull(),
    manifestUrl: text("manifest_url"),
    scopes: jsonb("scopes").$type<AppScope[]>().notNull(),
    clientId: text("client_id").notNull(),
    clientSecret: text("client_secret").notNull(),
    clientSecretHash: text("client_secret_hash").notNull(),
    /** The first few characters of the secret, so people can tell which one an app has. */
    clientSecretStart: text("client_secret_start").notNull(),
    installedBy: uuid("installed_by")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("apps_tenant_handle_unique").on(table.tenantId, table.handle),
    uniqueIndex("apps_client_id_unique").on(table.clientId),
    uniqueIndex("apps_client_secret_hash_unique").on(table.clientSecretHash),
    index("apps_tenant_created_idx").on(table.tenantId, table.createdAt),
  ],
);

export type AppRow = typeof appsTable.$inferSelect;
export type NewAppRow = typeof appsTable.$inferInsert;
