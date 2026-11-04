import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import type { Database } from "../database/client.js";
import { isUniqueViolation } from "../database/database-errors.js";
import { tableFor } from "../database/dialect/mysql-tables.js";
import { sitesTable } from "../sites/sites.table.js";
import { addTestSite, addTestUser, describeOnEveryDatabase } from "../testing/every-database.js";
import { usersTable } from "../users/users.table.js";
import {
  type AssetListFilter,
  deleteAssetRow,
  findAssetById,
  findAssetIdByContentHash,
  findAssetsByIdList,
  insertAsset,
  listAllStorageKeys,
  listAssetRows,
  updateAssetRow,
} from "./media.repository.js";
import type { NewAssetRow } from "./media.table.js";

const TENANT = "default";
const OTHER_TENANT = "other";
const EARLIER = new Date("2026-06-01T11:59:00.123Z");
const NOW = new Date("2026-06-01T12:00:00.123Z");
const LATER = new Date("2026-06-01T12:01:00.123Z");
const LONG_AGO = new Date("2000-01-01T00:00:00.000Z");

const CREDIT_DETAILS = {
  licence: "by",
  licenceName: "CC BY 2.0",
  licenceUrl: null,
  creator: "Zoë Ruiz",
  sourceUrl: "https://example.com/photo?id=1&size=l",
};

function addAsset(database: Database, filename = "a.png", values: Partial<NewAssetRow> = {}) {
  return insertAsset(database, {
    filename,
    storageKey: randomUUID(),
    mimeType: "image/png",
    size: 100,
    contentHash: randomUUID(),
    ...values,
  });
}

describeOnEveryDatabase("Media library", (handle) => {
  const filenamesFound = async (filter: Partial<AssetListFilter>) => {
    const { rows } = await listAssetRows(handle.database, TENANT, {
      limit: 20,
      offset: 0,
      ...filter,
    });
    return rows.map((row) => row.filename);
  };

  it("saves a file with the table's defaults", async () => {
    const { database } = handle;
    const asset = await addAsset(database);
    expect(asset).toMatchObject({
      tenantId: TENANT,
      siteId: null,
      filename: "a.png",
      mimeType: "image/png",
      size: 100,
      width: null,
      height: null,
      alt: "",
      credit: "",
      creditDetails: null,
      focalX: 0.5,
      focalY: 0.5,
      uploadedBy: null,
    });
    expect(asset.createdAt).toBeInstanceOf(Date);
  });

  it("keeps a file's details as given", async () => {
    const { database } = handle;
    const site = await addTestSite(database);
    const { id } = await addAsset(database, "Été à Malmö ☀.png", {
      siteId: site.id,
      width: 1920,
      height: 1080,
      alt: `Bob's "best" photo`,
      credit: "Photo by Zoë Ruiz",
      creditDetails: CREDIT_DETAILS,
      focalX: 0.25,
      focalY: 0.3,
      createdAt: EARLIER,
    });
    const found = await findAssetById(database, TENANT, id);
    expect(found).toMatchObject({
      siteId: site.id,
      filename: "Été à Malmö ☀.png",
      width: 1920,
      height: 1080,
      alt: `Bob's "best" photo`,
      credit: "Photo by Zoë Ruiz",
      creditDetails: CREDIT_DETAILS,
      focalX: 0.25,
      createdAt: EARLIER,
    });
    expect(found?.focalY).toBeCloseTo(0.3, 5);
  });

  it("refuses the same file twice, but only within one tenant", async () => {
    const { database } = handle;
    const contentHash = "same-bytes";
    await addAsset(database, "a.png", { contentHash });
    await expect(addAsset(database, "b.png", { contentHash })).rejects.toSatisfy((error) =>
      isUniqueViolation(error),
    );
    const theirs = await addAsset(database, "c.png", { contentHash, tenantId: OTHER_TENANT });
    expect(theirs.tenantId).toBe(OTHER_TENANT);
  });

  it("finds a file with its uploader's name, within a tenant", async () => {
    const { database } = handle;
    const user = await addTestUser(database);
    const asset = await addAsset(database, "a.png", { uploadedBy: user.id });
    const anonymous = await addAsset(database, "b.png");

    expect(await findAssetById(database, TENANT, asset.id)).toEqual({
      ...asset,
      uploaderName: "Ada",
    });
    expect((await findAssetById(database, TENANT, anonymous.id))?.uploaderName).toBeNull();
    expect(await findAssetById(database, TENANT, randomUUID())).toBeUndefined();
    expect(await findAssetById(database, OTHER_TENANT, asset.id)).toBeUndefined();
  });

  it("keeps a file when its uploader or its site goes", async () => {
    const { database } = handle;
    const user = await addTestUser(database);
    const site = await addTestSite(database);
    const { id } = await addAsset(database, "a.png", { uploadedBy: user.id, siteId: site.id });

    const users = tableFor(database, usersTable);
    await database.delete(users).where(eq(users.id, user.id));
    const sites = tableFor(database, sitesTable);
    await database.delete(sites).where(eq(sites.id, site.id));

    expect(await findAssetById(database, TENANT, id)).toMatchObject({
      uploadedBy: null,
      siteId: null,
      uploaderName: null,
    });
  });

  it("finds files by a list of ids", async () => {
    const { database } = handle;
    const first = await addAsset(database, "a.png");
    const second = await addAsset(database, "b.png");
    await addAsset(database, "c.png");
    const theirs = await addAsset(database, "d.png", { tenantId: OTHER_TENANT });

    const rows = await findAssetsByIdList(database, TENANT, [
      first.id,
      second.id,
      theirs.id,
      randomUUID(),
    ]);
    expect(rows.map((row) => row.filename).sort()).toEqual(["a.png", "b.png"]);
    expect(await findAssetsByIdList(database, TENANT, [])).toEqual([]);
  });

  it("finds a file by its content, within a tenant", async () => {
    const { database } = handle;
    const { id } = await addAsset(database, "a.png", { contentHash: "abc" });
    await addAsset(database, "b.png", { contentHash: "theirs", tenantId: OTHER_TENANT });
    expect(await findAssetIdByContentHash(database, TENANT, "abc")).toBe(id);
    expect(await findAssetIdByContentHash(database, TENANT, "ABC")).toBeUndefined();
    expect(await findAssetIdByContentHash(database, TENANT, "theirs")).toBeUndefined();
    expect(await findAssetIdByContentHash(database, OTHER_TENANT, "abc")).toBeUndefined();
  });

  it("lists the newest first, in pages that never overlap, with the total", async () => {
    const { database } = handle;
    const [lowerId, higherId] = [randomUUID(), randomUUID()].sort();
    await addAsset(database, "oldest.png", { createdAt: EARLIER });
    await addAsset(database, "tied-lower.png", { id: lowerId, createdAt: NOW });
    await addAsset(database, "tied-higher.png", { id: higherId, createdAt: NOW });
    await addAsset(database, "newest.png", { createdAt: LATER });
    await addAsset(database, "theirs.png", { tenantId: OTHER_TENANT });

    const first = await listAssetRows(database, TENANT, { limit: 3, offset: 0 });
    expect(first.total).toBe(4);
    expect(first.rows.map((row) => row.filename)).toEqual([
      "newest.png",
      "tied-higher.png",
      "tied-lower.png",
    ]);
    const second = await listAssetRows(database, TENANT, { limit: 3, offset: 3 });
    expect(second.total).toBe(4);
    expect(second.rows.map((row) => row.filename)).toEqual(["oldest.png"]);
  });

  it("gives each listed file its uploader's name", async () => {
    const { database } = handle;
    const user = await addTestUser(database);
    await addAsset(database, "a.png", { uploadedBy: user.id });
    await addAsset(database, "b.png");
    const { rows } = await listAssetRows(database, TENANT, { limit: 10, offset: 0 });
    expect(rows.find((row) => row.filename === "a.png")?.uploaderName).toBe("Ada");
    expect(rows.find((row) => row.filename === "b.png")?.uploaderName).toBeNull();
  });

  it("searches file names and alt text whatever the case", async () => {
    const { database } = handle;
    await addAsset(database, "Harbour.PNG");
    await addAsset(database, "b.png", { alt: "The old HARBOUR wall" });
    await addAsset(database, "c.png", { alt: "Bread" });
    expect((await filenamesFound({ search: "harbour" })).sort()).toEqual(["Harbour.PNG", "b.png"]);
    const { total } = await listAssetRows(database, TENANT, {
      search: "BREAD",
      limit: 10,
      offset: 0,
    });
    expect(total).toBe(1);
  });

  it("searches past plain English letters", async () => {
    const { database } = handle;
    await addAsset(database, "été-zoë.png");
    await addAsset(database, "ete-zoe.png");
    await addAsset(database, "sunny.png", { alt: "A day out 😀" });
    expect(await filenamesFound({ search: "été" })).toEqual(["été-zoë.png"]);
    expect(await filenamesFound({ search: "ÉTÉ" })).toEqual(["été-zoë.png"]);
    expect(await filenamesFound({ search: "😀" })).toEqual(["sunny.png"]);
  });

  it("searches for %, _ and \\ as themselves", async () => {
    const { database } = handle;
    await addAsset(database, "50%-off.png");
    await addAsset(database, "my_file.png");
    await addAsset(database, "myxfile.png");
    await addAsset(database, "back\\slash.png");
    expect(await filenamesFound({ search: "%" })).toEqual(["50%-off.png"]);
    expect(await filenamesFound({ search: "y_f" })).toEqual(["my_file.png"]);
    expect(await filenamesFound({ search: "k\\s" })).toEqual(["back\\slash.png"]);
  });

  it("filters by kind of file", async () => {
    const { database } = handle;
    await addAsset(database, "photo.png");
    await addAsset(database, "SHOUTED.PNG", { mimeType: "IMAGE/PNG" });
    await addAsset(database, "report.pdf", { mimeType: "application/pdf" });
    await addAsset(database, "chair.glb", { mimeType: "model/gltf-binary" });
    await addAsset(database, "wave.json", { mimeType: "application/json" });
    await addAsset(database, "spin.riv", { mimeType: "application/x-rive" });

    expect((await filenamesFound({ kind: "image" })).sort()).toEqual(["SHOUTED.PNG", "photo.png"]);
    expect((await filenamesFound({ kind: "document" })).sort()).toEqual([
      "report.pdf",
      "spin.riv",
      "wave.json",
    ]);
    expect(await filenamesFound({ kind: "model" })).toEqual(["chair.glb"]);
    expect((await filenamesFound({ kind: "animation" })).sort()).toEqual(["spin.riv", "wave.json"]);
  });

  it("filters by folder: one site's, the shared library or all", async () => {
    const { database } = handle;
    const site = await addTestSite(database);
    const other = await addTestSite(database, "other");
    await addAsset(database, "shared.png");
    await addAsset(database, "ours.png", { siteId: site.id });
    await addAsset(database, "other.png", { siteId: other.id });

    expect(await filenamesFound({ siteId: site.id })).toEqual(["ours.png"]);
    expect(await filenamesFound({ siteId: null })).toEqual(["shared.png"]);
    expect(await filenamesFound({})).toHaveLength(3);
  });

  it("finds pictures with no description, spaces counting as none", async () => {
    const { database } = handle;
    await addAsset(database, "empty.png");
    await addAsset(database, "spaces.png", { alt: "   " });
    await addAsset(database, "described.png", { alt: "A harbour" });
    await addAsset(database, "report.pdf", { mimeType: "application/pdf" });
    const found = await filenamesFound({ missingAlt: true });
    expect(found.sort()).toEqual(["empty.png", "spaces.png"]);
  });

  it("puts filters together", async () => {
    const { database } = handle;
    const site = await addTestSite(database);
    await addAsset(database, "harbour.png", { siteId: site.id });
    await addAsset(database, "harbour-described.png", { siteId: site.id, alt: "Boats" });
    await addAsset(database, "harbour-shared.png");
    await addAsset(database, "harbour.pdf", { siteId: site.id, mimeType: "application/pdf" });
    const found = await filenamesFound({
      search: "HARBOUR",
      kind: "image",
      siteId: site.id,
      missingAlt: true,
    });
    expect(found).toEqual(["harbour.png"]);
  });

  it("changes what editors can change, within a tenant", async () => {
    const { database } = handle;
    const site = await addTestSite(database);
    const { id } = await addAsset(database, "a.png", {
      siteId: site.id,
      credit: "Old",
      creditDetails: CREDIT_DETAILS,
      updatedAt: LONG_AGO,
    });
    await updateAssetRow(database, OTHER_TENANT, id, { alt: "Stolen" });
    expect((await findAssetById(database, TENANT, id))?.alt).toBe("");

    await updateAssetRow(database, TENANT, id, {
      alt: "A harbour",
      credit: "",
      creditDetails: null,
      focalX: 0,
      focalY: 1,
      filename: "harbour.png",
      siteId: null,
    });
    expect(await findAssetById(database, TENANT, id)).toMatchObject({
      alt: "A harbour",
      credit: "",
      creditDetails: null,
      focalX: 0,
      focalY: 1,
      filename: "harbour.png",
      siteId: null,
    });
    const found = await findAssetById(database, TENANT, id);
    expect(found?.updatedAt.getTime()).toBeGreaterThan(LONG_AGO.getTime());

    await updateAssetRow(database, TENANT, id, { creditDetails: CREDIT_DETAILS });
    expect((await findAssetById(database, TENANT, id))?.creditDetails).toEqual(CREDIT_DETAILS);
  });

  it("deletes a file, within a tenant", async () => {
    const { database } = handle;
    const { id } = await addAsset(database);
    const other = await addAsset(database, "b.png");
    await deleteAssetRow(database, OTHER_TENANT, id);
    expect(await findAssetById(database, TENANT, id)).toBeDefined();
    await deleteAssetRow(database, TENANT, id);
    expect(await findAssetById(database, TENANT, id)).toBeUndefined();
    expect(await findAssetById(database, TENANT, other.id)).toBeDefined();
  });

  it("lists every stored file of a tenant, oldest first", async () => {
    const { database } = handle;
    const add = (storageKey: string, createdAt: Date, values: Partial<NewAssetRow> = {}) =>
      addAsset(database, "a.png", { storageKey, createdAt, ...values });
    await add("newest", LATER, { mimeType: "application/pdf" });
    await add("oldest", EARLIER);
    await add("middle", NOW);
    await add("theirs", NOW, { tenantId: OTHER_TENANT });

    expect(await listAllStorageKeys(database, TENANT)).toEqual([
      { storageKey: "oldest", mimeType: "image/png" },
      { storageKey: "middle", mimeType: "image/png" },
      { storageKey: "newest", mimeType: "application/pdf" },
    ]);
    expect(await listAllStorageKeys(database, "nobody")).toEqual([]);
  });
});
