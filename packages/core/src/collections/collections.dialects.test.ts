import { expect, it } from "vitest";
import { insertBlueprint } from "../blueprints/blueprints.repository.js";
import type { Database } from "../database/client.js";
import { describeOnEveryDatabase } from "../testing/every-database.js";
import {
  countEntriesOutsideSite,
  deleteCollectionRow,
  findCollectionByHandle,
  findCollectionById,
  findCollectionWithDetails,
  insertCollection,
  insertCollectionIfMissing,
  listCollectionNamesUsingBlueprint,
  listCollectionsWithDetails,
  removeSiteFromCollections,
  updateCollectionRow,
} from "./collections.repository.js";

const TENANT = "default";
const SITE = "11111111-1111-4111-8111-111111111111";
const OTHER_SITE = "22222222-2222-4222-8222-222222222222";

async function addBlueprint(database: Database) {
  return insertBlueprint(database, { handle: "page", name: "Page", kind: "entry" });
}

describeOnEveryDatabase("Collections", (handle) => {
  it("saves a collection and lists it with its details", async () => {
    const { database } = handle;
    const blueprint = await addBlueprint(database);
    const collection = await insertCollection(database, {
      handle: "pages",
      name: "Pages",
      blueprintId: blueprint.id,
    });
    expect(collection.allowedChildren).toEqual([]);
    expect(collection.allowedAtRoot).toBe(true);

    const [listed] = await listCollectionsWithDetails(database, TENANT);
    expect(listed).toMatchObject({ blueprintHandle: "page", entryCount: 0 });
    const found = await findCollectionWithDetails(database, TENANT, "pages");
    expect(found?.id).toBe(collection.id);
    expect((await findCollectionByHandle(database, TENANT, "pages"))?.id).toBe(collection.id);
    expect((await findCollectionById(database, collection.id))?.name).toBe("Pages");
    expect(await listCollectionNamesUsingBlueprint(database, blueprint.id)).toEqual(["Pages"]);
    expect(await countEntriesOutsideSite(database, collection.id, SITE)).toBe(0);
  });

  it("adds a collection only if its handle is free, then changes and deletes it", async () => {
    const { database } = handle;
    const blueprint = await addBlueprint(database);
    const row = { handle: "pages", name: "Pages", blueprintId: blueprint.id };
    const added = await insertCollectionIfMissing(database, row);
    expect(await insertCollectionIfMissing(database, row)).toBeUndefined();
    await updateCollectionRow(database, added?.id ?? "", { name: "Everything" });
    expect((await findCollectionById(database, added?.id ?? ""))?.name).toBe("Everything");
    await deleteCollectionRow(database, added?.id ?? "");
    expect(await listCollectionsWithDetails(database, TENANT)).toEqual([]);
  });

  it("takes a deleted site out of the collections limited to it", async () => {
    const { database } = handle;
    const blueprint = await addBlueprint(database);
    const limited = await insertCollection(database, {
      handle: "limited",
      name: "Limited",
      blueprintId: blueprint.id,
      siteIds: [SITE, OTHER_SITE],
    });
    const open = await insertCollection(database, {
      handle: "open",
      name: "Open",
      blueprintId: blueprint.id,
    });
    await removeSiteFromCollections(database, SITE);
    expect((await findCollectionById(database, limited.id))?.siteIds).toEqual([OTHER_SITE]);
    expect((await findCollectionById(database, open.id))?.siteIds).toBeNull();
  });
});
