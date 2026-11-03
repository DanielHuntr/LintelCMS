import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import type { Site } from "../sites/sites.table.js";
import type { ScheduledEntriesQuery, ScheduledEntriesResponse } from "./entries.schema.js";
import { listEntriesScheduledBetween } from "./scheduled-entries.repository.js";

/** A month view shows at most 42 days; this leaves room without letting one request read everything. */
const MAX_SCHEDULED_ENTRIES = 500;

/**
 * What is due to be published between two moments, for the schedule calendar. Lintel only
 * schedules publishing (an entry's `scheduledFor`), so every item is a publish; `action`
 * leaves room for scheduled unpublishing if it comes.
 */
export async function listScheduledEntries(
  database: DatabaseOrTransaction,
  query: ScheduledEntriesQuery,
  site: Site,
): Promise<ScheduledEntriesResponse> {
  const rows = await listEntriesScheduledBetween(database, {
    tenantId: DEFAULT_TENANT_ID,
    siteId: site.id,
    from: query.from,
    to: query.to,
    limit: MAX_SCHEDULED_ENTRIES,
  });
  return {
    entries: rows.map((row) => ({
      id: row.id,
      title: row.title ?? "",
      locale: row.locale,
      collectionHandle: row.collectionHandle,
      collectionName: row.collectionName,
      scheduledFor: row.scheduledFor.toISOString(),
      action: "publish" as const,
    })),
  };
}
