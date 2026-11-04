import { expect, it } from "vitest";
import { describeOnEveryDatabase } from "../testing/every-database.js";
import {
  deleteBackupRow,
  failRunningBackups,
  findBackupRow,
  insertBackupRow,
  listBackupRows,
  listCompleteBackupsBy,
  updateBackupRow,
} from "./backups.repository.js";

const TENANT = "default";
const big = 5_000_000_000;

describeOnEveryDatabase("Backups", (handle) => {
  it("records a backup finishing, with a size over 4 GB", async () => {
    const { database } = handle;
    const backup = await insertBackupRow(database, { filename: "a.zip", trigger: "manual" });
    expect(backup.status).toBe("running");
    await updateBackupRow(database, backup.id, { status: "complete", size: big });
    expect((await findBackupRow(database, TENANT, backup.id))?.size).toBe(big);
    expect(await listCompleteBackupsBy(database, TENANT, "manual")).toHaveLength(1);
    expect(await listBackupRows(database, TENANT)).toHaveLength(1);
  });

  it("fails backups left running, and deletes them", async () => {
    const { database } = handle;
    const backup = await insertBackupRow(database, { filename: "a.zip", trigger: "manual" });
    await failRunningBackups(database, TENANT, "The server restarted");
    expect(await findBackupRow(database, TENANT, backup.id)).toMatchObject({
      status: "failed",
      failureReason: "The server restarted",
    });
    await deleteBackupRow(database, backup.id);
    expect(await listBackupRows(database, TENANT)).toEqual([]);
  });
});
