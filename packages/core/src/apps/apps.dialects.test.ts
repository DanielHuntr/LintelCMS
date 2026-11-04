import { expect, it } from "vitest";
import type { Database } from "../database/client.js";
import { addTestUser, describeOnEveryDatabase } from "../testing/every-database.js";
import {
  deleteAppRow,
  findAppRow,
  findAppRowByHandle,
  findAppRowBySecretHash,
  insertApp,
  listAppRows,
  recordAppUse,
} from "./apps.repository.js";

const TENANT = "default";

async function addApp(database: Database) {
  const user = await addTestUser(database);
  return insertApp(database, {
    handle: "stock-sync",
    name: "Stock sync",
    manifest: { name: "Stock sync" } as never,
    scopes: [],
    clientId: "client",
    clientSecret: "secret",
    clientSecretHash: "hash",
    clientSecretStart: "sec",
    installedBy: user.id,
  });
}

describeOnEveryDatabase("Apps", (handle) => {
  it("saves an app, finds it each way, and lists it with who installed it", async () => {
    const { database } = handle;
    const app = await addApp(database);
    expect(app.manifest).toEqual({ name: "Stock sync" });
    expect((await findAppRow(database, TENANT, app.id))?.id).toBe(app.id);
    expect((await findAppRowByHandle(database, TENANT, "stock-sync"))?.id).toBe(app.id);
    expect((await findAppRowBySecretHash(database, "hash"))?.id).toBe(app.id);
    expect(await listAppRows(database, TENANT)).toHaveLength(1);
  });

  it("records its use and deletes it once", async () => {
    const { database } = handle;
    const app = await addApp(database);
    const usedAt = new Date("2026-11-04T10:00:00.000Z");
    await recordAppUse(database, app.id, usedAt);
    expect((await findAppRowBySecretHash(database, "hash"))?.lastUsedAt).toEqual(usedAt);
    expect(await deleteAppRow(database, TENANT, app.id)).toBe(true);
    expect(await deleteAppRow(database, TENANT, app.id)).toBe(false);
  });
});
