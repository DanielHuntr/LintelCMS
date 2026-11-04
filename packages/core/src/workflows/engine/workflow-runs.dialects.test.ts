import { expect, it } from "vitest";
import type { Database } from "../../database/client.js";
import { describeOnEveryDatabase } from "../../testing/every-database.js";
import { insertWorkflow } from "../workflows.repository.js";
import {
  cancelRunRow,
  claimDueRun,
  findDueRunIds,
  findLatestRunRows,
  findRunByIdempotencyKey,
  findRunRow,
  insertRunUnlessDuplicate,
  insertStepLog,
  listRunRows,
  listRunRowsForEntry,
  listStepLogRows,
  updateRunRow,
  wakeRun,
} from "./workflow-runs.repository.js";

const TENANT = "default";
const ENTRY = "11111111-1111-4111-8111-111111111111";
const now = new Date("2026-11-04T10:00:00.000Z");
const lease = new Date("2026-11-04T10:05:00.000Z");

async function addRun(
  database: Database,
  values: { idempotencyKey?: string; createdAt?: Date } = {},
) {
  const workflow = await insertWorkflow(database, {
    name: "Review",
    trigger: {} as never,
    steps: [],
    secret: "secret",
  });
  return addRunOf(database, workflow.id, values);
}

async function addRunOf(
  database: Database,
  workflowId: string,
  values: { idempotencyKey?: string; createdAt?: Date } = {},
) {
  const run = await insertRunUnlessDuplicate(database, {
    workflowId,
    workflowName: "Review",
    definition: { trigger: {}, steps: [] } as never,
    context: { a: 1 },
    entryId: ENTRY,
    nextRunAt: now,
    ...values,
  });
  if (!run) throw new Error("The run was not saved.");
  return run;
}

describeOnEveryDatabase("Workflow runs", (handle) => {
  it("starts a run once per key, and finds it", async () => {
    const { database } = handle;
    const run = await addRun(database, { idempotencyKey: "key" });
    const again = await insertRunUnlessDuplicate(database, {
      workflowId: run.workflowId,
      workflowName: "Review",
      definition: run.definition,
      context: {},
      idempotencyKey: "key",
    });
    expect(again).toBeUndefined();
    expect((await findRunRow(database, TENANT, run.id))?.context).toEqual({ a: 1 });
    const byKey = await findRunByIdempotencyKey(database, run.workflowId, "key");
    expect(byKey?.id).toBe(run.id);
    const listed = await listRunRows(database, TENANT, run.workflowId, { limit: 10, offset: 0 });
    expect(listed.total).toBe(1);
    const forEntry = await listRunRowsForEntry(database, TENANT, ENTRY, [run.workflowId]);
    expect(forEntry).toHaveLength(1);
  });

  it("can start many runs with no key", async () => {
    const { database } = handle;
    const run = await addRun(database);
    await addRunOf(database, run.workflowId);
    const listed = await listRunRows(database, TENANT, run.workflowId, { limit: 10, offset: 0 });
    expect(listed.total).toBe(2);
  });

  it("shows each workflow's latest run, every column read properly", async () => {
    const { database } = handle;
    const first = await addRun(database, { createdAt: new Date("2026-11-01T00:00:00.000Z") });
    const latest = await addRunOf(database, first.workflowId, {
      createdAt: new Date("2026-11-02T00:00:00.000Z"),
    });
    expect(await findLatestRunRows(database, [])).toEqual([]);
    const rows = await findLatestRunRows(database, [first.workflowId]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: latest.id, isTest: false, context: { a: 1 } });
    expect(rows[0]?.createdAt).toEqual(new Date("2026-11-02T00:00:00.000Z"));
  });

  it("lets only one server claim a due run", async () => {
    const { database } = handle;
    const run = await addRun(database);
    expect(await findDueRunIds(database, now, 10)).toEqual([run.id]);
    const claims = await Promise.all([
      claimDueRun(database, run.id, now, lease),
      claimDueRun(database, run.id, now, lease),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);
  });

  it("waits, wakes and cancels a run", async () => {
    const { database } = handle;
    const run = await addRun(database);
    await updateRunRow(database, run.id, { status: "waiting", nextRunAt: null });
    await wakeRun(database, run.id, now);
    expect((await findRunRow(database, TENANT, run.id))?.nextRunAt).toEqual(now);
    expect(await cancelRunRow(database, run.id, now)).toBe(true);
    expect(await cancelRunRow(database, run.id, now)).toBe(false);
  });

  it("numbers a run's log lines in order", async () => {
    const { database } = handle;
    const run = await addRun(database);
    const line = { runId: run.id, stepId: "a", stepType: "email", status: "done" as never };
    await insertStepLog(database, { ...line, summary: "First" });
    await insertStepLog(database, { ...line, summary: "Second" });
    const logs = await listStepLogRows(database, run.id);
    expect(logs.map((log) => [log.position, log.summary])).toEqual([
      [0, "First"],
      [1, "Second"],
    ]);
  });
});
