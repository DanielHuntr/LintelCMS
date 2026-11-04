import { and, asc, desc, eq, inArray, ne, sql, sum } from "drizzle-orm";
import { collectionsTable as collectionsDefinition } from "../collections/collections.table.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { entriesTable as entriesDefinition } from "../entries/entries.table.js";
import type { VersionKey } from "./experiments.schema.js";
import {
  experimentCountsTable as experimentCountsDefinition,
  type ExperimentRow,
  experimentsTable as experimentsDefinition,
  type ExperimentVersionRow,
  experimentVersionsTable as experimentVersionsDefinition,
  type NewExperimentRow,
} from "./experiments.table.js";
import { insertReturning, upsert } from "../database/dialect/writes.js";
import { tableFor } from "../database/dialect/mysql-tables.js";

/** Database reads and writes for A/B tests, their versions and their counts. Nothing else. */

export interface ExperimentWithPage {
  experiment: ExperimentRow;
  pageTitle: string;
  collection: string;
}

function selectWithPage(database: DatabaseOrTransaction) {
  const collectionsTable = tableFor(database, collectionsDefinition);
  const entriesTable = tableFor(database, entriesDefinition);
  const experimentsTable = tableFor(database, experimentsDefinition);
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
  const experimentsTable = tableFor(database, experimentsDefinition);
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
  const experimentsTable = tableFor(database, experimentsDefinition);
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
  const experimentsTable = tableFor(database, experimentsDefinition);
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
  const experimentsTable = tableFor(database, experimentsDefinition);
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
  const experimentsTable = tableFor(database, experimentsDefinition);
  const [inserted] = await insertReturning(database, experimentsTable, row);
  if (!inserted) throw new Error("Saving the test returned nothing.");
  return inserted;
}

export async function updateExperimentRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  experimentId: string,
  changes: Partial<NewExperimentRow>,
): Promise<void> {
  const experimentsTable = tableFor(database, experimentsDefinition);
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
  const experimentsTable = tableFor(database, experimentsDefinition);
  await database
    .delete(experimentsTable)
    .where(and(eq(experimentsTable.tenantId, tenantId), eq(experimentsTable.id, experimentId)));
}

export async function listVersionRows(
  database: DatabaseOrTransaction,
  tenantId: string,
  experimentIds: readonly string[],
): Promise<ExperimentVersionRow[]> {
  const experimentVersionsTable = tableFor(database, experimentVersionsDefinition);
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
  const experimentVersionsTable = tableFor(database, experimentVersionsDefinition);
  await upsert(database, experimentVersionsTable, row, {
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
  const experimentVersionsTable = tableFor(database, experimentVersionsDefinition);
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
  const experimentCountsTable = tableFor(database, experimentCountsDefinition);
  await upsert(database, experimentCountsTable, row, {
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
  const experimentCountsTable = tableFor(database, experimentCountsDefinition);
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
