import { expect, it } from "vitest";
import type { Database } from "../../database/client.js";
import { addTestUser, describeOnEveryDatabase } from "../../testing/every-database.js";
import { insertRunUnlessDuplicate } from "../engine/workflow-runs.repository.js";
import { insertWorkflow } from "../workflows.repository.js";
import {
  decideApprovalRow,
  findApprovalRow,
  insertApprovalUnlessDuplicate,
  listApprovalRowsForEntry,
  listPendingApprovalRows,
} from "./approvals.repository.js";

const TENANT = "default";
const ENTRY = "11111111-1111-4111-8111-111111111111";
const now = new Date("2026-11-04T10:00:00.000Z");

async function addRun(database: Database) {
  const workflow = await insertWorkflow(database, {
    name: "Review",
    trigger: {} as never,
    steps: [],
    secret: "secret",
  });
  const run = await insertRunUnlessDuplicate(database, {
    workflowId: workflow.id,
    workflowName: "Review",
    definition: { trigger: {}, steps: [] } as never,
    context: {},
  });
  if (!run) throw new Error("The run was not saved.");
  return run;
}

describeOnEveryDatabase("Workflow approvals", (handle) => {
  it("asks once per step, and takes the first answer", async () => {
    const { database } = handle;
    const run = await addRun(database);
    const user = await addTestUser(database);
    const request = { runId: run.id, stepId: "a", role: "editor", entryId: ENTRY };
    const approval = await insertApprovalUnlessDuplicate(database, request);
    const again = await insertApprovalUnlessDuplicate(database, { ...request, message: "x" });
    expect(again.id).toBe(approval.id);

    expect(await listPendingApprovalRows(database, TENANT, ["editor"])).toHaveLength(1);
    expect(await listPendingApprovalRows(database, TENANT, ["owner"])).toEqual([]);
    expect(await listPendingApprovalRows(database, TENANT, [])).toEqual([]);
    expect(await listPendingApprovalRows(database, TENANT, "every role")).toHaveLength(1);

    const decision = {
      status: "approved" as const,
      decidedBy: user.id,
      comment: "Good",
      decidedAt: now,
    };
    expect((await decideApprovalRow(database, approval.id, decision))?.status).toBe("approved");
    expect(await decideApprovalRow(database, approval.id, decision)).toBeUndefined();
    expect((await findApprovalRow(database, TENANT, approval.id))?.comment).toBe("Good");
    const [listed] = await listApprovalRowsForEntry(database, TENANT, ENTRY);
    expect(listed?.decidedByName).toBe("Ada");
  });
});
