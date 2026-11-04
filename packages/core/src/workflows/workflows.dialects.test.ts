import { expect, it } from "vitest";
import type { Database } from "../database/client.js";
import { describeOnEveryDatabase } from "../testing/every-database.js";
import {
  deleteWorkflowRow,
  findWorkflowRow,
  insertWorkflow,
  listEnabledWorkflowRows,
  listWorkflowRows,
  listWorkflowRowsByPurpose,
  updateWorkflowRow,
} from "./workflows.repository.js";

const TENANT = "default";

function addWorkflow(database: Database, purpose: string | null = null) {
  return insertWorkflow(database, {
    name: "Review",
    trigger: { kind: "event" } as never,
    steps: [],
    secret: "secret",
    purpose,
  });
}

describeOnEveryDatabase("Workflows", (handle) => {
  it("saves a workflow, finds it and lists it by purpose", async () => {
    const { database } = handle;
    const workflow = await addWorkflow(database, "review");
    await addWorkflow(database);
    expect(workflow.trigger).toEqual({ kind: "event" });
    expect((await findWorkflowRow(database, TENANT, workflow.id))?.id).toBe(workflow.id);
    expect(await listWorkflowRows(database, TENANT)).toHaveLength(2);
    const byPurpose = await listWorkflowRowsByPurpose(database, TENANT, ["review"]);
    expect(byPurpose.map((row) => row.id)).toEqual([workflow.id]);
  });

  it("changes one, returning it, and lists only those switched on", async () => {
    const { database } = handle;
    const workflow = await addWorkflow(database);
    const changed = await updateWorkflowRow(database, workflow.id, { enabled: false });
    expect(changed?.enabled).toBe(false);
    expect(await listEnabledWorkflowRows(database, TENANT)).toEqual([]);
    await deleteWorkflowRow(database, workflow.id);
    expect(await listWorkflowRows(database, TENANT)).toEqual([]);
  });
});
