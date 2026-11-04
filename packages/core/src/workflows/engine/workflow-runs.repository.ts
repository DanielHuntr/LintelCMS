import { and, asc, desc, eq, getTableColumns, inArray, lte, ne, or, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../database/client.js";
import {
  type NewWorkflowRunRow,
  type NewWorkflowStepLogRow,
  type WorkflowRunRow,
  workflowRunsTable as workflowRunsDefinition,
  type WorkflowStepLogRow,
  workflowStepLogsTable as workflowStepLogsDefinition,
} from "../workflows.table.js";
import { insertIfNewReturning, updateReturning } from "../../database/dialect/writes.js";
import { tableFor } from "../../database/dialect/mysql-tables.js";
import { capabilitiesOf } from "../../database/dialect/database-dialect.js";
import { selectNewestPerGroup } from "../../database/dialect/reads.js";

/** Database reads and writes for runs and their logs, nothing else. */

/** Inserts the run unless one with the same workflow and idempotency key exists. */
export async function insertRunUnlessDuplicate(
  database: DatabaseOrTransaction,
  run: NewWorkflowRunRow,
): Promise<WorkflowRunRow | undefined> {
  const workflowRunsTable = tableFor(database, workflowRunsDefinition);
  const [inserted] = await insertIfNewReturning(database, workflowRunsTable, run, {
    target: [workflowRunsTable.workflowId, workflowRunsTable.idempotencyKey],
  });
  return inserted;
}

export async function findRunRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  runId: string,
): Promise<WorkflowRunRow | undefined> {
  const workflowRunsTable = tableFor(database, workflowRunsDefinition);
  const [run] = await database
    .select()
    .from(workflowRunsTable)
    .where(and(eq(workflowRunsTable.tenantId, tenantId), eq(workflowRunsTable.id, runId)))
    .limit(1);
  return run;
}

export async function findRunByIdempotencyKey(
  database: DatabaseOrTransaction,
  workflowId: string,
  idempotencyKey: string,
): Promise<WorkflowRunRow | undefined> {
  const workflowRunsTable = tableFor(database, workflowRunsDefinition);
  const [run] = await database
    .select()
    .from(workflowRunsTable)
    .where(
      and(
        eq(workflowRunsTable.workflowId, workflowId),
        eq(workflowRunsTable.idempotencyKey, idempotencyKey),
      ),
    )
    .limit(1);
  return run;
}

export async function listRunRows(
  database: DatabaseOrTransaction,
  tenantId: string,
  workflowId: string,
  page: { limit: number; offset: number },
): Promise<{ rows: WorkflowRunRow[]; total: number }> {
  const workflowRunsTable = tableFor(database, workflowRunsDefinition);
  const where = and(
    eq(workflowRunsTable.tenantId, tenantId),
    eq(workflowRunsTable.workflowId, workflowId),
  );
  const rows = await database
    .select()
    .from(workflowRunsTable)
    .where(where)
    .orderBy(desc(workflowRunsTable.createdAt), desc(workflowRunsTable.id))
    .limit(page.limit)
    .offset(page.offset);
  const [count] = await database
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(workflowRunsTable)
    .where(where);
  return { rows, total: count?.total ?? 0 };
}

/** The newest run of each workflow, for the list. */
export async function findLatestRunRows(
  database: DatabaseOrTransaction,
  workflowIds: string[],
): Promise<WorkflowRunRow[]> {
  const workflowRunsTable = tableFor(database, workflowRunsDefinition);
  if (workflowIds.length === 0) {
    return [];
  }
  return selectNewestPerGroup(database, workflowRunsTable, {
    fields: getTableColumns(workflowRunsTable),
    groupBy: workflowRunsTable.workflowId,
    newest: workflowRunsTable.createdAt,
    where: inArray(workflowRunsTable.workflowId, workflowIds),
  });
}

export async function listRunRowsForEntry(
  database: DatabaseOrTransaction,
  tenantId: string,
  entryId: string,
  workflowIds: string[],
): Promise<WorkflowRunRow[]> {
  const workflowRunsTable = tableFor(database, workflowRunsDefinition);
  if (workflowIds.length === 0) {
    return [];
  }
  return database
    .select()
    .from(workflowRunsTable)
    .where(
      and(
        eq(workflowRunsTable.tenantId, tenantId),
        eq(workflowRunsTable.entryId, entryId),
        inArray(workflowRunsTable.workflowId, workflowIds),
      ),
    )
    .orderBy(asc(workflowRunsTable.createdAt));
}

export async function findDueRunIds(
  database: DatabaseOrTransaction,
  now: Date,
  limit: number,
): Promise<string[]> {
  const workflowRunsTable = tableFor(database, workflowRunsDefinition);
  const rows = await database
    .select({ id: workflowRunsTable.id })
    .from(workflowRunsTable)
    .where(dueCondition(workflowRunsTable, now))
    .orderBy(asc(workflowRunsTable.nextRunAt))
    .limit(limit);
  return rows.map((row) => row.id);
}

/** Queued or waiting runs whose time has come, and running ones whose server went away. */
function dueCondition(workflowRunsTable: typeof workflowRunsDefinition, now: Date) {
  return or(
    and(
      inArray(workflowRunsTable.status, ["queued", "waiting"]),
      lte(workflowRunsTable.nextRunAt, now),
    ),
    and(eq(workflowRunsTable.status, "running"), lte(workflowRunsTable.leaseUntil, now)),
  );
}

/**
 * Claims a due run in one update, so only one server works on it. If that server stops
 * mid-run, the lease runs out and the run is due again.
 */
export async function claimDueRun(
  database: DatabaseOrTransaction,
  runId: string,
  now: Date,
  leaseUntil: Date,
): Promise<WorkflowRunRow | undefined> {
  const workflowRunsTable = tableFor(database, workflowRunsDefinition);
  const [run] = await updateReturning(
    database,
    workflowRunsTable,
    { status: "running", leaseUntil, nextRunAt: null },
    and(eq(workflowRunsTable.id, runId), dueCondition(workflowRunsTable, now)),
  );
  return run;
}

/** Saves a run's progress. A cancelled run stays cancelled, even mid-step. */
export async function updateRunRow(
  database: DatabaseOrTransaction,
  runId: string,
  changes: Partial<NewWorkflowRunRow>,
): Promise<void> {
  const workflowRunsTable = tableFor(database, workflowRunsDefinition);
  await database
    .update(workflowRunsTable)
    .set(changes)
    .where(and(eq(workflowRunsTable.id, runId), ne(workflowRunsTable.status, "cancelled")));
}

/** Stops a run that hasn't finished. Returns whether it was stopped. */
export async function cancelRunRow(
  database: DatabaseOrTransaction,
  runId: string,
  now: Date,
): Promise<boolean> {
  const workflowRunsTable = tableFor(database, workflowRunsDefinition);
  const cancelled = await updateReturning(
    database,
    workflowRunsTable,
    { status: "cancelled", finishedAt: now, nextRunAt: null, leaseUntil: null },
    and(
      eq(workflowRunsTable.id, runId),
      inArray(workflowRunsTable.status, ["queued", "running", "waiting"]),
    ),
    { id: workflowRunsTable.id },
  );
  return cancelled.length > 0;
}

/** Makes a waiting run due now, for example once its approval is answered. */
export async function wakeRun(database: DatabaseOrTransaction, runId: string, now: Date) {
  const workflowRunsTable = tableFor(database, workflowRunsDefinition);
  await database
    .update(workflowRunsTable)
    .set({ nextRunAt: now })
    .where(and(eq(workflowRunsTable.id, runId), eq(workflowRunsTable.status, "waiting")));
}

export async function insertStepLog(
  database: DatabaseOrTransaction,
  log: NewWorkflowStepLogRow,
): Promise<void> {
  const workflowStepLogsTable = tableFor(database, workflowStepLogsDefinition);
  const inThisRun = eq(workflowStepLogsTable.runId, log.runId);
  // One run's steps go one at a time, so counting first is safe where it has to be done.
  const position = capabilitiesOf(database).insertsReadTheirOwnTable
    ? sql<number>`(select count(*) from ${workflowStepLogsTable} where ${inThisRun})`
    : await database.$count(workflowStepLogsTable, inThisRun);
  await database.insert(workflowStepLogsTable).values({ ...log, position });
}

export async function listStepLogRows(
  database: DatabaseOrTransaction,
  runId: string,
): Promise<WorkflowStepLogRow[]> {
  const workflowStepLogsTable = tableFor(database, workflowStepLogsDefinition);
  return database
    .select()
    .from(workflowStepLogsTable)
    .where(eq(workflowStepLogsTable.runId, runId))
    .orderBy(asc(workflowStepLogsTable.position), asc(workflowStepLogsTable.createdAt));
}
