import { inArray } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import { hasPermission } from "../roles/permissions.js";
import { findPermissionsForUser } from "../roles/roles.service.js";
import type { WebhookEventName } from "../webhooks/webhook-events.js";
import { permissionNeededForEvent } from "./app-scopes.js";
import { appsTable } from "./apps.table.js";
import { tableFor } from "../database/dialect/mysql-tables.js";

/**
 * Of these apps, the ones whose installer may see what this event carries. An app never has
 * more access than the person who installed it, and that goes for what it is sent as well as
 * what it can ask for. Worked out for each event, so a change to their role applies at once.
 */
export async function findAppsAllowedEvent(
  database: DatabaseOrTransaction,
  appIds: readonly string[],
  event: WebhookEventName,
): Promise<Set<string>> {
  if (appIds.length === 0) return new Set();
  const appRows = tableFor(database, appsTable);
  const apps = await database
    .select({ id: appRows.id, installedBy: appRows.installedBy })
    .from(appRows)
    .where(inArray(appRows.id, [...appIds]));
  const allowed = new Set<string>();
  for (const app of apps) {
    const permissions = await findPermissionsForUser(database, app.installedBy);
    if (hasPermission(permissions, permissionNeededForEvent(event))) allowed.add(app.id);
  }
  return allowed;
}
