import { expect, it } from "vitest";
import { addTestSite, describeOnEveryDatabase } from "../testing/every-database.js";
import {
  countEntriesInLocale,
  deleteSiteLocale,
  findSiteLocale,
  insertSiteLocaleIfMissing,
  listSiteLocales,
  renameSiteLocale,
} from "./locales.repository.js";
import {
  countEntriesInSite,
  deleteSiteRow,
  findHighestSortOrder,
  findSiteByHandle,
  findSiteById,
  insertSiteIfMissing,
  listSiteRows,
  listSitesWithEntryCounts,
  updateSiteRow,
} from "./sites.repository.js";

const TENANT = "default";
const site = { handle: "uk", name: "UK", domain: "uk.test", hostnames: ["uk.test", "b.test"] };

describeOnEveryDatabase("Sites", (handle) => {
  it("adds a site once, and finds it", async () => {
    const { database } = handle;
    const added = await insertSiteIfMissing(database, site);
    expect(added?.hostnames).toEqual(site.hostnames);
    expect(await insertSiteIfMissing(database, site)).toBeUndefined();
    expect((await findSiteByHandle(database, TENANT, "uk"))?.id).toBe(added?.id);
    expect((await findSiteById(database, added?.id ?? ""))?.handle).toBe("uk");
  });

  it("lists sites in order, with entry counts", async () => {
    const { database } = handle;
    const first = await addTestSite(database, "first");
    await addTestSite(database, "second");
    await updateSiteRow(database, first.id, { name: "Renamed", hostnames: ["x.test"] });

    const rows = await listSiteRows(database, TENANT);
    expect(rows.map((row) => row.handle)).toEqual(["first", "second"]);
    expect(rows[0]).toMatchObject({ name: "Renamed", hostnames: ["x.test"] });

    const counted = await listSitesWithEntryCounts(database, TENANT);
    expect(counted[0]?.entryCount).toBe(0);
    expect(await countEntriesInSite(database, first.id)).toBe(0);
    expect(await findHighestSortOrder(database, TENANT)).toBe(0);
  });

  it("deletes a site", async () => {
    const { database } = handle;
    const added = await addTestSite(database);
    await deleteSiteRow(database, added.id);
    expect(await listSiteRows(database, TENANT)).toEqual([]);
  });
});

describeOnEveryDatabase("Site locales", (handle) => {
  it("adds, renames, counts and deletes a language", async () => {
    const { database } = handle;
    const { id: siteId } = await addTestSite(database);
    const locale = { siteId, code: "fr", name: "French" };
    await insertSiteLocaleIfMissing(database, locale);
    await insertSiteLocaleIfMissing(database, { ...locale, name: "Ignored" });

    const found = await findSiteLocale(database, siteId, "fr");
    expect(found?.name).toBe("French");
    await renameSiteLocale(database, found?.id ?? "", "Français");

    const listed = await listSiteLocales(database, siteId);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ name: "Français", entryCount: 0 });
    expect(await countEntriesInLocale(database, siteId, "fr")).toBe(0);

    await deleteSiteLocale(database, found?.id ?? "");
    expect(await findSiteLocale(database, siteId, "fr")).toBeUndefined();
  });
});
