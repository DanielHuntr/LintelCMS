import { expect, it } from "vitest";
import { addTestEntry, describeOnEveryDatabase } from "../testing/every-database.js";
import { findEntrySeoRow, listSitemapEntryRows, upsertEntrySeoRow } from "./seo.repository.js";

const TENANT = "default";
const values = { title: "A", description: "", socialImageId: null, noindex: false };

describeOnEveryDatabase("SEO", (handle) => {
  it("saves an entry's SEO details, changing them on the second save", async () => {
    const { database } = handle;
    const { id } = await addTestEntry(database);
    await upsertEntrySeoRow(database, TENANT, id, values);
    await upsertEntrySeoRow(database, TENANT, id, { ...values, title: "B", noindex: true });
    expect(await findEntrySeoRow(database, TENANT, id)).toMatchObject({
      title: "B",
      noindex: true,
    });
  });

  it("lists published pages for the sitemap", async () => {
    const { database } = handle;
    const entry = await addTestEntry(database, { publishedData: { title: "Home" } });
    await addTestEntry(database, { slug: "draft" });
    const rows = await listSitemapEntryRows(database, TENANT, 10);
    expect(rows.map((row) => row.id)).toEqual([entry.id]);
    expect(rows[0]?.noindex).toBeNull();
  });
});
