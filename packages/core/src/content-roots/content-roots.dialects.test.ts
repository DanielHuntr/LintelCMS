import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import { collectionsTable } from "../collections/collections.table.js";
import { tableFor } from "../database/dialect/mysql-tables.js";
import { addTestEntry, describeOnEveryDatabase } from "../testing/every-database.js";
import {
  deleteRootAddressRow,
  findEntryAddressRows,
  findEntryPlaces,
  findRootAddressRow,
  listSiteStartHostnameRows,
  listSiteStartRows,
  saveRootAddressRow,
} from "./content-roots.repository.js";

const TENANT = "default";

describeOnEveryDatabase("Content roots", (handle) => {
  it("saves one address for a site start, and lists its domain", async () => {
    const { database } = handle;
    const entry = await addTestEntry(database);
    const address = { hostname: "example.com", pathPrefix: "" };
    await saveRootAddressRow(database, TENANT, entry.id, address);
    await saveRootAddressRow(database, TENANT, entry.id, { ...address, pathPrefix: "/fr" });
    expect((await findRootAddressRow(database, TENANT, entry.id))?.pathPrefix).toBe("/fr");
    expect(await listSiteStartHostnameRows(database, TENANT, entry.siteId)).toEqual([
      { siteId: entry.siteId, hostname: "example.com" },
    ]);
    await deleteRootAddressRow(database, TENANT, entry.id);
    expect(await findRootAddressRow(database, TENANT, entry.id)).toBeUndefined();
  });

  it("lists the top of each page tree, with titles", async () => {
    const { database } = handle;
    const entry = await addTestEntry(database, { data: { title: "Home" } });
    const collections = tableFor(database, collectionsTable);
    await database
      .update(collections)
      .set({ structure: "tree" })
      .where(eq(collections.id, entry.collectionId));
    const rows = await listSiteStartRows(database, TENANT, entry.siteId, entry.locale);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ title: "Home", hostname: null, collectionHandle: "pages" });
  });

  it("finds where entries sit and what their addresses need", async () => {
    const { database } = handle;
    const entry = await addTestEntry(database, { data: { title: "Home" } });
    expect((await findEntryPlaces(database, [entry.id]))[0]?.slug).toBe("home");
    const [row] = await findEntryAddressRows(database, [entry.id]);
    expect(row).toMatchObject({ title: "Home", routePattern: "/{slug}" });
  });
});
