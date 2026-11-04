import { and, asc, eq, gte, inArray, lt, lte, ne } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../database/client.js";
import type { RollupDimension } from "./analytics-events.js";
import {
  type AnalyticsDailyRow,
  analyticsDailyTable as analyticsDailyDefinition,
  analyticsEventsTable as analyticsEventsDefinition,
  analyticsSaltsTable as analyticsSaltsDefinition,
  type NewAnalyticsEvent,
} from "./analytics.table.js";
import type { DailyFigures, EventForRollup } from "./daily-rollups.js";
import { deleteReturning, insertIfNew } from "../database/dialect/writes.js";
import { tableFor } from "../database/dialect/mysql-tables.js";

/** Database reads and writes for visitor counts, nothing else. */

export async function insertEvent(
  database: DatabaseOrTransaction,
  event: NewAnalyticsEvent,
): Promise<void> {
  const analyticsEventsTable = tableFor(database, analyticsEventsDefinition);
  await database.insert(analyticsEventsTable).values(event);
}

/** Today's salt, made the first time it is asked for. Two servers asking at once agree. */
export async function findOrCreateSalt(
  database: DatabaseOrTransaction,
  tenantId: string,
  day: string,
  newSalt: string,
): Promise<string> {
  const analyticsSaltsTable = tableFor(database, analyticsSaltsDefinition);
  await insertIfNew(database, analyticsSaltsTable, { tenantId, day, salt: newSalt });
  const [row] = await database
    .select({ salt: analyticsSaltsTable.salt })
    .from(analyticsSaltsTable)
    .where(and(eq(analyticsSaltsTable.tenantId, tenantId), eq(analyticsSaltsTable.day, day)));
  if (!row) throw new Error("Saving today's visitor salt returned nothing.");
  return row.salt;
}

/** Forgets every salt except `keepDay`'s, so older hashes can never be worked out again. */
export async function deleteSaltsExcept(
  database: DatabaseOrTransaction,
  tenantId: string,
  keepDay: string,
): Promise<void> {
  const analyticsSaltsTable = tableFor(database, analyticsSaltsDefinition);
  await database
    .delete(analyticsSaltsTable)
    .where(and(eq(analyticsSaltsTable.tenantId, tenantId), ne(analyticsSaltsTable.day, keepDay)));
}

export async function listEventsForDay(
  database: DatabaseOrTransaction,
  tenantId: string,
  siteId: string,
  day: string,
): Promise<EventForRollup[]> {
  const analyticsEventsTable = tableFor(database, analyticsEventsDefinition);
  return database
    .select({
      kind: analyticsEventsTable.kind,
      visitorHash: analyticsEventsTable.visitorHash,
      path: analyticsEventsTable.path,
      source: analyticsEventsTable.source,
      campaign: analyticsEventsTable.campaign,
      device: analyticsEventsTable.device,
      country: analyticsEventsTable.country,
      durationMs: analyticsEventsTable.durationMs,
      name: analyticsEventsTable.name,
      value: analyticsEventsTable.value,
      properties: analyticsEventsTable.properties,
    })
    .from(analyticsEventsTable)
    .where(
      and(
        eq(analyticsEventsTable.tenantId, tenantId),
        eq(analyticsEventsTable.siteId, siteId),
        eq(analyticsEventsTable.day, day),
      ),
    );
}

/** The sites with any events on these days, so the rollup only visits those. */
export async function listSiteIdsWithEvents(
  database: DatabaseOrTransaction,
  tenantId: string,
  days: readonly string[],
): Promise<string[]> {
  const analyticsEventsTable = tableFor(database, analyticsEventsDefinition);
  const rows = await database
    .selectDistinct({ siteId: analyticsEventsTable.siteId })
    .from(analyticsEventsTable)
    .where(
      and(
        eq(analyticsEventsTable.tenantId, tenantId),
        inArray(analyticsEventsTable.day, [...days]),
      ),
    );
  return rows.map((row) => row.siteId);
}

/** Replaces one day's figures for a site with freshly counted ones. */
export async function replaceDailyFigures(
  database: DatabaseOrTransaction,
  tenantId: string,
  siteId: string,
  day: string,
  figures: readonly DailyFigures[],
): Promise<void> {
  const analyticsDailyTable = tableFor(database, analyticsDailyDefinition);
  await database.transaction(async (transaction) => {
    await transaction
      .delete(analyticsDailyTable)
      .where(
        and(
          eq(analyticsDailyTable.tenantId, tenantId),
          eq(analyticsDailyTable.siteId, siteId),
          eq(analyticsDailyTable.day, day),
        ),
      );
    if (figures.length > 0) {
      await transaction
        .insert(analyticsDailyTable)
        .values(figures.map((row) => ({ ...row, tenantId, siteId, day })));
    }
  });
}

export interface DailyFiguresQuery {
  tenantId: string;
  siteId: string;
  fromDay: string;
  toDay: string;
  dimensions?: readonly RollupDimension[];
  key?: string;
}

export async function listDailyFigures(
  database: DatabaseOrTransaction,
  query: DailyFiguresQuery,
): Promise<AnalyticsDailyRow[]> {
  const analyticsDailyTable = tableFor(database, analyticsDailyDefinition);
  return database
    .select()
    .from(analyticsDailyTable)
    .where(
      and(
        eq(analyticsDailyTable.tenantId, query.tenantId),
        eq(analyticsDailyTable.siteId, query.siteId),
        gte(analyticsDailyTable.day, query.fromDay),
        lte(analyticsDailyTable.day, query.toDay),
        query.dimensions
          ? inArray(analyticsDailyTable.dimension, [...query.dimensions])
          : undefined,
        query.key === undefined ? undefined : eq(analyticsDailyTable.key, query.key),
      ),
    )
    .orderBy(asc(analyticsDailyTable.day), asc(analyticsDailyTable.dimension));
}

/** Deletes single visits from days before `firstKeptDay`, whole days only; the figures stay. */
export async function deleteEventsBeforeDay(
  database: DatabaseOrTransaction,
  tenantId: string,
  firstKeptDay: string,
): Promise<number> {
  const analyticsEventsTable = tableFor(database, analyticsEventsDefinition);
  const deleted = await deleteReturning(
    database,
    analyticsEventsTable,
    and(eq(analyticsEventsTable.tenantId, tenantId), lt(analyticsEventsTable.day, firstKeptDay)),
    { id: analyticsEventsTable.id },
  );
  return deleted.length;
}

/** Every day that still has single visits, oldest first. */
export async function listDaysWithEvents(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<string[]> {
  const analyticsEventsTable = tableFor(database, analyticsEventsDefinition);
  const rows = await database
    .selectDistinct({ day: analyticsEventsTable.day })
    .from(analyticsEventsTable)
    .where(eq(analyticsEventsTable.tenantId, tenantId))
    .orderBy(asc(analyticsEventsTable.day));
  return rows.map((row) => row.day);
}
