import { expect, it } from "vitest";
import { addTestEntry, describeOnEveryDatabase } from "../testing/every-database.js";
import { listCollectionPages } from "./starter-sites.repository.js";

describeOnEveryDatabase("Starter sites", (handle) => {
  it("lists a collection's pages with their titles", async () => {
    const { database } = handle;
    const entry = await addTestEntry(database, { data: { title: "Home" } });
    const pages = await listCollectionPages(
      database,
      entry.collectionId,
      entry.siteId,
      entry.locale,
    );
    expect(pages).toEqual([{ id: entry.id, slug: entry.slug, parentId: null, title: "Home" }]);
  });
});
