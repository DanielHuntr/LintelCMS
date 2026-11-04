import { expect, it } from "vitest";
import type { Database } from "../database/client.js";
import { describeOnEveryDatabase } from "../testing/every-database.js";
import {
  deleteTargetRow,
  findRunRow,
  findTargetRow,
  insertRunRow,
  insertTargetRow,
  listRunRows,
  listTargetRows,
  recordReceipt,
  updateRunRow,
  updateTargetRow,
} from "./publishing.repository.js";

const TENANT = "default";

function addTarget(database: Database) {
  return insertTargetRow(database, { name: "Live", kind: "folder" as never });
}

describeOnEveryDatabase("Publishing", (handle) => {
  it("saves targets, changing and deleting them", async () => {
    const { database } = handle;
    const target = await addTarget(database);
    expect(target.options).toEqual({});
    const changed = await updateTargetRow(database, target.id, { name: "Staging" });
    expect(changed?.name).toBe("Staging");
    expect((await findTargetRow(database, TENANT, target.id))?.deleteLimit).toBe(50);
    expect(await listTargetRows(database, TENANT)).toHaveLength(1);
    expect(await deleteTargetRow(database, TENANT, target.id)).toBe(true);
    expect(await deleteTargetRow(database, TENANT, target.id)).toBe(false);
  });

  it("records runs, with a summary that can be left empty", async () => {
    const { database } = handle;
    const target = await addTarget(database);
    const run = await insertRunRow(database, { targetId: target.id, trigger: "manual" as never });
    expect(run).toMatchObject({ status: "running", summary: null });
    const finishedAt = new Date("2026-11-04T10:00:00.000Z");
    await updateRunRow(database, run.id, { status: "succeeded" as never, finishedAt });
    expect((await findRunRow(database, TENANT, run.id))?.finishedAt).toEqual(finishedAt);
    expect(await listRunRows(database, TENANT, target.id, 10)).toHaveLength(1);
  });

  it("takes each thing from the bridge once", async () => {
    const { database } = handle;
    const target = await addTarget(database);
    const receipt = { targetId: target.id, itemId: "a", kind: "order" } as const;
    expect(await recordReceipt(database, receipt)).toBe(true);
    expect(await recordReceipt(database, receipt)).toBe(false);
  });
});
