import { and, asc, desc, eq, inArray, lte, ne, or, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../database/client.js";
import {
  type NewWorkflowRunRow,
  type NewWorkflowStepLogRow,
  type WorkflowRunRow,
  workflowRunsTable,
  type WorkflowStepLogRow,
  workflowStepLogsTable,
} from "../workflows.table.js";

/** Database reads and writes for runs and their logs, nothing else. */

/** Inserts the run unless one with the same workflow and idempotency key exists. */
export async function insertRunUnlessDuplicate(
  database: DatabaseOrTransaction,
  run: NewWorkflowRunRow,
): Promise<WorkflowRunRow | undefined> {
  const [inserted] = await database
    .insert(workflowRunsTable)
    .values(run)
    .onConflictDoNothing({
      target: [workflowRunsTable.workflowId, workflowRunsTable.idempotencyKey],
    })
    .returning();
  return inserted;
}

export async function findRunRow(
  database: DatabaseOrTransaction,
  tenantId: string,
  runId: string,
): Promise<WorkflowRunRow | undefined> {
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
  if (workflowIds.length === 0) {
    return [];
  }
  return database
    .selectDistinctOn([workflowRunsTable.workflowId])
    .from(workflowRunsTable)
    .where(inArray(workflowRunsTable.workflowId, workflowIds))
    .orderBy(workflowRunsTable.workflowId, desc(workflowRunsTable.createdAt));
}

export async function listRunRowsForEntry(
  database: DatabaseOrTransaction,
  tenantId: string,
  entryId: string,
  workflowIds: string[],
): Promise<WorkflowRunRow[]> {
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
  const rows = await database
    .select({ id: workflowRunsTable.id })
    .from(workflowRunsTable)
    .where(dueCondition(now))
    .orderBy(asc(workflowRunsTable.nextRunAt))
    .limit(limit);
  return rows.map((row) => row.id);
}

/** Queued or waiting runs whose time has come, and running ones whose server went away. */
function dueCondition(now: Date) {
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
  const [run] = await database
    .update(workflowRunsTable)
    .set({ status: "running", leaseUntil, nextRunAt: null })
    .where(and(eq(workflowRunsTable.id, runId), dueCondition(now)))
    .returning();
  return run;
}

/** Saves a run's progress. A cancelled run stays cancelled, even mid-step. */
export async function updateRunRow(
  database: DatabaseOrTransaction,
  runId: string,
  changes: Partial<NewWorkflowRunRow>,
): Promise<void> {
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
  const cancelled = await database
    .update(workflowRunsTable)
    .set({ status: "cancelled", finishedAt: now, nextRunAt: null, leaseUntil: null })
    .where(
      and(
        eq(workflowRunsTable.id, runId),
        inArray(workflowRunsTable.status, ["queued", "running", "waiting"]),
      ),
    )
    .returning({ id: workflowRunsTable.id });
  return cancelled.length > 0;
}

/** Makes a waiting run due now, for example once its approval is answered. */
export async function wakeRun(database: DatabaseOrTransaction, runId: string, now: Date) {
  await database
    .update(workflowRunsTable)
    .set({ nextRunAt: now })
    .where(and(eq(workflowRunsTable.id, runId), eq(workflowRunsTable.status, "waiting")));
}

export async function insertStepLog(
  database: DatabaseOrTransaction,
  log: NewWorkflowStepLogRow,
): Promise<void> {
  const position = sql<number>`(select count(*) from ${workflowStepLogsTable} where ${workflowStepLogsTable.runId} = ${log.runId})`;
  await database.insert(workflowStepLogsTable).values({ ...log, position });
}

export async function listStepLogRows(
  database: DatabaseOrTransaction,
  runId: string,
): Promise<WorkflowStepLogRow[]> {
  return database
    .select()
    .from(workflowStepLogsTable)
    .where(eq(workflowStepLogsTable.runId, runId))
    .orderBy(asc(workflowStepLogsTable.position), asc(workflowStepLogsTable.createdAt));
}
