import { and, asc, desc, eq, inArray, ne, sql, sum } from "drizzle-orm";
import { collectionsTable } from "../collections/collections.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { entriesTable } from "../entries/entries.table.js";
import type { VersionKey } from "./experiments.schema.js";
import {
  experimentCountsTable,
  type ExperimentRow,
  experimentsTable,
  type ExperimentVersionRow,
  experimentVersionsTable,
  type NewExperimentRow,
} from "./experiments.table.js";

/** Database reads and writes for A/B tests, their versions and their counts. Nothing else. */

export interface ExperimentWithPage {
  experiment: ExperimentRow;
  pageTitle: string;
  collection: string;
}

function selectWithPage(database: DatabaseOrTransaction) {
  return database
    .select({
      experiment: experimentsTable,
      pageData: entriesTable.data,
      collection: collectionsTable.handle,
    })
    .from(experimentsTable)
    .innerJoin(entriesTable, eq(entriesTable.id, experimentsTable.entryId))
    .innerJoin(collectionsTable, eq(collectionsTable.id, entriesTable.collectionId));
}

function withPage(row: {
  experiment: ExperimentRow;
  pageData: Record<string, unknown>;
  collection: string;
}): ExperimentWithPage {
  const title = row.pageData.title;
  return {
    experiment: row.experiment,
    pageTitle: typeof title === "string" ? title : "",
    collection: row.collection,
  };
}

export async function listExperimentRows(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<ExperimentWithPage[]> {
  const rows = await selectWithPage(database)
    .where(eq(experimentsTable.tenantId, tenantId))
    .orderBy(desc(experimentsTable.createdAt));
  return rows.map(withPage);
}

export async function findExperimentRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  experimentId: string,
): Promise<ExperimentWithPage | undefined> {
  const [row] = await selectWithPage(database).where(
    and(eq(experimentsTable.tenantId, tenantId), eq(experimentsTable.id, experimentId)),
  );
  return row ? withPage(row) : undefined;
}

/** The page's test that hasn't ended yet, if it has one: a page has one at a time. */
export async function findOpenExperimentRowForEntry(
  database: DatabaseOrTransaction,
  tenantId: string,
  entryId: string,
): Promise<ExperimentWithPage | undefined> {
  const [row] = await selectWithPage(database)
    .where(
      and(
        eq(experimentsTable.tenantId, tenantId),
        eq(experimentsTable.entryId, entryId),
        ne(experimentsTable.status, "ended"),
      ),
    )
    .orderBy(desc(experimentsTable.createdAt))
    .limit(1);
  return row ? withPage(row) : undefined;
}

export async function listRunningExperimentRows(
  database: DatabaseOrTransaction,
  tenantId: string,
): Promise<ExperimentRow[]> {
  return database
    .select()
    .from(experimentsTable)
    .where(and(eq(experimentsTable.tenantId, tenantId), eq(experimentsTable.status, "running")))
    .orderBy(asc(experimentsTable.createdAt));
}

export async function insertExperimentRow(
  database: DatabaseOrTransaction,
  row: NewExperimentRow,
): Promise<ExperimentRow> {
  const [inserted] = await database.insert(experimentsTable).values(row).returning();
  if (!inserted) throw new Error("Saving the test returned nothing.");
  return inserted;
}

export async function updateExperimentRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  experimentId: string,
  changes: Partial<NewExperimentRow>,
): Promise<void> {
  await database
    .update(experimentsTable)
    .set(changes)
    .where(and(eq(experimentsTable.tenantId, tenantId), eq(experimentsTable.id, experimentId)));
}

export async function deleteExperimentRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  experimentId: string,
): Promise<void> {
  await database
    .delete(experimentsTable)
    .where(and(eq(experimentsTable.tenantId, tenantId), eq(experimentsTable.id, experimentId)));
}

export async function listVersionRows(
  database: DatabaseOrTransaction,
  tenantId: string,
  experimentIds: readonly string[],
): Promise<ExperimentVersionRow[]> {
  if (experimentIds.length === 0) return [];
  return database
    .select()
    .from(experimentVersionsTable)
    .where(
      and(
        eq(experimentVersionsTable.tenantId, tenantId),
        inArray(experimentVersionsTable.experimentId, [...experimentIds]),
      ),
    )
    .orderBy(asc(experimentVersionsTable.key));
}

export async function saveVersionRow(
  database: DatabaseOrTransaction,
  row: { tenantId: string; experimentId: string; key: VersionKey; design: Record<string, unknown> },
): Promise<void> {
  await database
    .insert(experimentVersionsTable)
    .values(row)
    .onConflictDoUpdate({
      target: [experimentVersionsTable.experimentId, experimentVersionsTable.key],
      set: { design: row.design, updatedAt: new Date() },
    });
}

export async function deleteVersionRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  experimentId: string,
  key: VersionKey,
): Promise<void> {
  await database
    .delete(experimentVersionsTable)
    .where(
      and(
        eq(experimentVersionsTable.tenantId, tenantId),
        eq(experimentVersionsTable.experimentId, experimentId),
        eq(experimentVersionsTable.key, key),
      ),
    );
}

/** Adds to one version's count for one day, starting the day's row when it is the first. */
export async function addToCounts(
  database: DatabaseOrTransaction,
  row: {
    tenantId: string;
    experimentId: string;
    versionKey: VersionKey;
    day: string;
    visitors: number;
    conversions: number;
  },
): Promise<void> {
  await database
    .insert(experimentCountsTable)
    .values(row)
    .onConflictDoUpdate({
      target: [
        experimentCountsTable.experimentId,
        experimentCountsTable.versionKey,
        experimentCountsTable.day,
      ],
      set: {
        visitors: sql`${experimentCountsTable.visitors} + ${row.visitors}`,
        conversions: sql`${experimentCountsTable.conversions} + ${row.conversions}`,
      },
    });
}

export async function sumCountsByVersion(
  database: DatabaseOrTransaction,
  tenantId: string,
  experimentId: string,
): Promise<Array<{ versionKey: VersionKey; visitors: number; conversions: number }>> {
  const rows = await database
    .select({
      versionKey: experimentCountsTable.versionKey,
      visitors: sum(experimentCountsTable.visitors).mapWith(Number),
      conversions: sum(experimentCountsTable.conversions).mapWith(Number),
    })
    .from(experimentCountsTable)
    .where(
      and(
        eq(experimentCountsTable.tenantId, tenantId),
        eq(experimentCountsTable.experimentId, experimentId),
      ),
    )
    .groupBy(experimentCountsTable.versionKey);
  return rows.map((row) => ({
    versionKey: row.versionKey,
    visitors: row.visitors ?? 0,
    conversions: row.conversions ?? 0,
  }));
}
