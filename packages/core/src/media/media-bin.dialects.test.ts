import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { addTestSite, addTestUser, describeOnEveryDatabase } from "../testing/every-database.js";
import {
  deleteBinnedAssetRow,
  findBinnedAsset,
  insertBinnedAsset,
  listAllBinnedAssets,
  listBinnedAssetRows,
  siteExists,
  userExists,
} from "./media-bin.repository.js";

const TENANT = "default";

describeOnEveryDatabase("Media recycle bin", (handle) => {
  it("keeps a deleted file's details and who binned it", async () => {
    const { database } = handle;
    const user = await addTestUser(database);
    const id = randomUUID();
    const asset = { id, filename: "a.png" } as never;
    await insertBinnedAsset(database, { id, filename: "a.png", asset, deletedBy: user.id });

    expect((await findBinnedAsset(database, TENANT, id))?.asset).toEqual({ id, filename: "a.png" });
    const [listed] = await listBinnedAssetRows(database, TENANT, 10);
    expect(listed?.deletedByName).toBe("Ada");
    expect(await listAllBinnedAssets(database, TENANT)).toHaveLength(1);

    await deleteBinnedAssetRow(database, TENANT, id);
    expect(await findBinnedAsset(database, TENANT, id)).toBeUndefined();
  });

  it("knows which people and sites still exist", async () => {
    const { database } = handle;
    const user = await addTestUser(database);
    const site = await addTestSite(database);
    expect(await userExists(database, user.id)).toBe(true);
    expect(await siteExists(database, site.id)).toBe(true);
    expect(await userExists(database, randomUUID())).toBe(false);
    expect(await siteExists(database, randomUUID())).toBe(false);
  });
});
