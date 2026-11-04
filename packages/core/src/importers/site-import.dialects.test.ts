import { expect, it } from "vitest";
import type { Database } from "../database/client.js";
import { addTestEntry, describeOnEveryDatabase } from "../testing/every-database.js";
import {
  claimImportToRun,
  countFinishedItems,
  deleteImport,
  findEntryFromEarlierImport,
  findImport,
  findTargets,
  finishItem,
  insertImport,
  insertItemIfMissing,
  insertItems,
  listImports,
  listItems,
  listPendingItems,
  pauseRunningImports,
  updateImport,
  findAllowedChildren,
} from "./site-import.repository.js";

const TENANT = "default";

function addImport(database: Database) {
  return insertImport(database, {
    filename: "site.zip",
    siteAddress: "https://old.example.com",
    found: {} as never,
    source: "webflow" as never,
  });
}

function item(importId: string, sourceId: string, position: number) {
  return { importId, kind: "page", sourceId, position, payload: { sourceId } };
}

describeOnEveryDatabase("Site imports", (handle) => {
  it("saves an import, lets one run claim it, and pauses it", async () => {
    const { database } = handle;
    const added = await addImport(database);
    expect((await findImport(database, TENANT, added.id))?.status).toBe("ready");
    expect(await listImports(database, TENANT)).toHaveLength(1);

    await updateImport(database, added.id, { lastError: "Old" });
    const claims = await Promise.all([
      claimImportToRun(database, added.id),
      claimImportToRun(database, added.id),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);

    await pauseRunningImports(database, TENANT, "The server restarted");
    expect((await findImport(database, TENANT, added.id))?.lastError).toBe("The server restarted");
    await deleteImport(database, added.id);
    expect(await listImports(database, TENANT)).toEqual([]);
  });

  it("works through its items once each", async () => {
    const { database } = handle;
    const { id } = await addImport(database);
    await insertItems(database, [item(id, "a", 1), item(id, "b", 2)]);
    await insertItemIfMissing(database, item(id, "b", 3));
    await insertItemIfMissing(database, item(id, "c", 3));
    expect(await listItems(database, id)).toHaveLength(3);

    const [first] = await listPendingItems(database, id, 1);
    expect(first?.payload).toEqual({ sourceId: "a" });
    const target = "11111111-1111-4111-8111-111111111111";
    await finishItem(database, first?.id ?? "", {
      status: "done",
      targetId: target,
      message: null,
      details: null,
    } as never);
    expect(await countFinishedItems(database, id)).toBe(1);
    expect(await listPendingItems(database, id, 10)).toHaveLength(2);
    expect((await findTargets(database, id, ["page"])).get("page:a")).toBe(target);
  });

  it("finds an entry an earlier import of the same site made", async () => {
    const { database } = handle;
    const entry = await addTestEntry(database);
    const earlier = await addImport(database);
    const later = await addImport(database);
    await insertItems(database, [item(earlier.id, "a", 1)]);
    const [saved] = await listItems(database, earlier.id);
    await finishItem(database, saved?.id ?? "", {
      status: "done",
      targetId: entry.id,
      message: null,
      details: null,
    } as never);
    const found = await findEntryFromEarlierImport(
      database,
      later.id,
      { source: "webflow", siteAddress: "https://old.example.com" },
      { kind: "page", sourceId: "a" },
    );
    expect(found).toBe(entry.id);
  });

  it("reads what a collection allows beneath it", async () => {
    const { database } = handle;
    const entry = await addTestEntry(database);
    expect(await findAllowedChildren(database, entry.collectionId)).toEqual([]);
  });
});
