import { expect, it } from "vitest";
import type { Database } from "../database/client.js";
import { addTestSite, describeOnEveryDatabase } from "../testing/every-database.js";
import {
  deleteGlobalSetRow,
  findGlobalSetByHandle,
  insertGlobalSetIfMissing,
  listGlobalSetRows,
  updateGlobalSetRow,
} from "./global-sets.repository.js";
import {
  findAllGlobalValues,
  findGlobalValues,
  findGlobalValuesMentioning,
  replaceGlobalValuesData,
  upsertGlobalValues,
} from "./global-values.repository.js";

const TENANT = "default";
const ASSET = "11111111-1111-4111-8111-111111111111";

async function addGlobalSet(database: Database) {
  const set = await insertGlobalSetIfMissing(database, { handle: "footer", name: "Footer" });
  if (!set) throw new Error("The global set was not saved.");
  return set;
}

describeOnEveryDatabase("Global sets", (handle) => {
  it("adds a set once, changes it and deletes it", async () => {
    const { database } = handle;
    const set = await addGlobalSet(database);
    expect(await insertGlobalSetIfMissing(database, { handle: "footer", name: "x" })).toBe(
      undefined,
    );
    await updateGlobalSetRow(database, set.id, { name: "Bottom", fields: [] });
    expect((await findGlobalSetByHandle(database, TENANT, "footer"))?.name).toBe("Bottom");
    expect(await listGlobalSetRows(database, TENANT)).toHaveLength(1);
    await deleteGlobalSetRow(database, set.id);
    expect(await listGlobalSetRows(database, TENANT)).toEqual([]);
  });
});

describeOnEveryDatabase("Global values", (handle) => {
  it("saves values per language, changing rather than duplicating", async () => {
    const { database } = handle;
    const { id: globalSetId } = await addGlobalSet(database);
    const { id: siteId } = await addTestSite(database);
    const save = (data: Record<string, unknown>) =>
      upsertGlobalValues(database, { globalSetId, siteId, locale: "en", data, updatedBy: null });
    await save({ text: "first" });
    await save({ text: "second" });

    const rows = await findGlobalValues(database, globalSetId, siteId, ["en"]);
    expect(rows.map((row) => row.data)).toEqual([{ text: "second" }]);
    expect(await findAllGlobalValues(database, siteId, ["en"])).toHaveLength(1);
    expect(await findGlobalValues(database, globalSetId, siteId, ["fr"])).toEqual([]);
  });

  it("finds values that mention an id, exactly, and replaces them", async () => {
    const { database } = handle;
    const { id: globalSetId } = await addGlobalSet(database);
    const { id: siteId } = await addTestSite(database);
    const data = { logo: { assetId: ASSET } };
    await upsertGlobalValues(database, {
      globalSetId,
      siteId,
      locale: "en",
      data,
      updatedBy: null,
    });

    const [found] = await findGlobalValuesMentioning(database, ASSET);
    expect(found?.data).toEqual(data);
    expect(await findGlobalValuesMentioning(database, ASSET.slice(0, 20))).toEqual([]);

    await replaceGlobalValuesData(database, found?.id ?? "", {});
    expect(await findGlobalValuesMentioning(database, ASSET)).toEqual([]);
  });
});
