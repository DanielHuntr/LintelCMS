import { expect, it } from "vitest";
import type { Database } from "../database/client.js";
import { addTestEntry, describeOnEveryDatabase } from "../testing/every-database.js";
import {
  addToCounts,
  deleteExperimentRow,
  deleteVersionRow,
  findExperimentRow,
  findOpenExperimentRowForEntry,
  insertExperimentRow,
  listExperimentRows,
  listRunningExperimentRows,
  listVersionRows,
  saveVersionRow,
  sumCountsByVersion,
  updateExperimentRow,
} from "./experiments.repository.js";

const tenantId = "default";

async function addExperiment(database: Database) {
  const entry = await addTestEntry(database, { data: { title: "Home" } });
  const experiment = await insertExperimentRow(database, {
    entryId: entry.id,
    scope: "page" as never,
    split: [50, 50],
    secret: "secret",
  });
  return { entry, experiment };
}

describeOnEveryDatabase("A/B tests", (handle) => {
  it("saves a test and reads it with its page", async () => {
    const { database } = handle;
    const { entry, experiment } = await addExperiment(database);
    expect(experiment.split).toEqual([50, 50]);
    const [listed] = await listExperimentRows(database, tenantId);
    expect(listed).toMatchObject({ pageTitle: "Home", collection: "pages" });
    expect((await findExperimentRow(database, tenantId, experiment.id))?.pageTitle).toBe("Home");
    const open = await findOpenExperimentRowForEntry(database, tenantId, entry.id);
    expect(open?.experiment.id).toBe(experiment.id);
  });

  it("changes a test's status, and deletes it", async () => {
    const { database } = handle;
    const { experiment } = await addExperiment(database);
    await updateExperimentRow(database, tenantId, experiment.id, { status: "running" as never });
    expect(await listRunningExperimentRows(database, tenantId)).toHaveLength(1);
    await deleteExperimentRow(database, tenantId, experiment.id);
    expect(await listExperimentRows(database, tenantId)).toEqual([]);
  });

  it("saves one design per version", async () => {
    const { database } = handle;
    const { experiment } = await addExperiment(database);
    const row = { tenantId, experimentId: experiment.id, key: "b" as never };
    await saveVersionRow(database, { ...row, design: { a: 1 } });
    await saveVersionRow(database, { ...row, design: { a: 2 } });
    const versions = await listVersionRows(database, tenantId, [experiment.id]);
    expect(versions.map((version) => version.design)).toEqual([{ a: 2 }]);
    await deleteVersionRow(database, tenantId, experiment.id, "b" as never);
    expect(await listVersionRows(database, tenantId, [experiment.id])).toEqual([]);
  });

  it("adds to the day's counts and sums them as numbers", async () => {
    const { database } = handle;
    const { experiment } = await addExperiment(database);
    const row = { tenantId, experimentId: experiment.id, versionKey: "a" as never };
    await addToCounts(database, { ...row, day: "2026-11-03", visitors: 2, conversions: 1 });
    await addToCounts(database, { ...row, day: "2026-11-03", visitors: 3, conversions: 0 });
    await addToCounts(database, { ...row, day: "2026-11-04", visitors: 1, conversions: 1 });
    expect(await sumCountsByVersion(database, tenantId, experiment.id)).toEqual([
      { versionKey: "a", visitors: 6, conversions: 2 },
    ]);
  });
});
