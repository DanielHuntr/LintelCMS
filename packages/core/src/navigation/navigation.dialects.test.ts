import { expect, it } from "vitest";
import { addTestEntry, addTestSite, describeOnEveryDatabase } from "../testing/every-database.js";
import {
  deleteNavigationRow,
  findLinkedEntries,
  findMenuPageRow,
  findNavigationByHandle,
  insertNavigationIfMissing,
  listMenuTreePages,
  listNavigationRows,
  updateNavigationRow,
} from "./navigation.repository.js";

const TENANT = "default";

describeOnEveryDatabase("Menus", (handle) => {
  it("adds a menu once per site, changes it and deletes it", async () => {
    const { database } = handle;
    const { id: siteId } = await addTestSite(database);
    const row = { siteId, handle: "main", name: "Main" };
    const menu = await insertNavigationIfMissing(database, row);
    expect(menu?.pageTree).toEqual({ includeHome: true, hiddenEntryIds: [], labels: {} });
    expect(await insertNavigationIfMissing(database, row)).toBeUndefined();

    await updateNavigationRow(database, menu?.id ?? "", { name: "Top", maxDepth: 2 });
    const found = await findNavigationByHandle(database, TENANT, siteId, "main");
    expect(found).toMatchObject({ name: "Top", maxDepth: 2 });
    await deleteNavigationRow(database, menu?.id ?? "");
    expect(await listNavigationRows(database, TENANT, siteId)).toEqual([]);
  });

  it("reads the entries and pages a menu links to", async () => {
    const { database } = handle;
    const entry = await addTestEntry(database, { data: { title: "Home" } });
    expect(await findLinkedEntries(database, [])).toEqual([]);
    const [linked] = await findLinkedEntries(database, [entry.id]);
    expect(linked).toMatchObject({ title: "Home", collectionHandle: "pages", status: "draft" });
    expect((await findMenuPageRow(database, entry.id))?.routePattern).toBe("/{slug}");
    // The test collection is flat, so it isn't part of a page tree.
    expect(await listMenuTreePages(database, TENANT, entry.siteId, entry.locale)).toEqual([]);
  });
});
