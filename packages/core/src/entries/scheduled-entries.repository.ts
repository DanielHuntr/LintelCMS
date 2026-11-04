import { and, asc, eq, gte, lt, or } from "drizzle-orm";
import { collectionsTable as collectionsDefinition } from "../collections/collections.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { jsonText } from "../database/dialect/expressions.js";
import { entriesTable as entriesDefinition } from "./entries.table.js";
import { tableFor } from "../database/dialect/mysql-tables.js";

/** Database reads for the schedule calendar, nothing else. */

export interface ScheduledEntryRow {
  id: string;
  title: string | null;
  locale: string;
  scheduledFor: Date;
  collectionHandle: string;
  collectionName: string;
}

export interface ScheduledEntryFilter {
  tenantId: string;
  /** The site being worked on: its own entries, and those of shared collections. */
  siteId: string;
  from: Date;
  to: Date;
  /** More than a month view could ever show; the calendar asks for one month at a time. */
  limit: number;
}

/** Entries waiting to be published from `from` (included) until `to`, soonest first. */
export async function listEntriesScheduledBetween(
  database: DatabaseOrTransaction,
  filter: ScheduledEntryFilter,
): Promise<ScheduledEntryRow[]> {
  const collectionsTable = tableFor(database, collectionsDefinition);
  const entriesTable = tableFor(database, entriesDefinition);
  const rows = await database
    .select({
      id: entriesTable.id,
      title: jsonText(database, entriesTable.data, "title"),
      locale: entriesTable.locale,
      scheduledFor: entriesTable.scheduledFor,
      collectionHandle: collectionsTable.handle,
      collectionName: collectionsTable.name,
    })
    .from(entriesTable)
    .innerJoin(collectionsTable, eq(collectionsTable.id, entriesTable.collectionId))
    .where(
      and(
        eq(entriesTable.tenantId, filter.tenantId),
        eq(entriesTable.status, "scheduled"),
        gte(entriesTable.scheduledFor, filter.from),
        lt(entriesTable.scheduledFor, filter.to),
        or(eq(entriesTable.siteId, filter.siteId), eq(collectionsTable.siteScope, "shared")),
      ),
    )
    .orderBy(asc(entriesTable.scheduledFor), asc(entriesTable.id))
    .limit(filter.limit);
  return rows.flatMap((row) =>
    row.scheduledFor ? [{ ...row, scheduledFor: row.scheduledFor }] : [],
  );
}
