import { expect, it } from "vitest";
import { insertFormRow } from "../forms/forms.repository.js";
import { insertTaxonomyIfMissing } from "../taxonomies/taxonomies.repository.js";
import { insertTerm } from "../taxonomies/terms.repository.js";
import { addTestEntry, describeOnEveryDatabase } from "../testing/every-database.js";
import {
  findReferencedVersions,
  listBlockVersions,
  listFormVersions,
  listPublishedEntryRows,
  listTermRows,
} from "./static-site.repository.js";

const TENANT = "default";

describeOnEveryDatabase("Publishing as files", (handle) => {
  it("reads a site's published pages and when they changed", async () => {
    const { database } = handle;
    const entry = await addTestEntry(database, { publishedData: { title: "Home" } });
    await addTestEntry(database, { slug: "draft" });
    const sites = { siteId: entry.siteId, defaultSiteId: entry.siteId };
    const rows = await listPublishedEntryRows(database, TENANT, sites);
    expect(rows.map((row) => row.id)).toEqual([entry.id]);
    expect(rows[0]?.publishedData).toEqual({ title: "Home" });

    expect(await findReferencedVersions(database, [])).toEqual(new Map());
    const versions = await findReferencedVersions(database, [entry.id]);
    expect(versions.get(entry.id)).toBe(entry.updatedAt.toISOString());
  });

  it("reads terms, forms and blocks", async () => {
    const { database } = handle;
    const taxonomy = await insertTaxonomyIfMissing(database, { handle: "tags", name: "Tags" });
    await insertTerm(database, { taxonomyId: taxonomy?.id ?? "", title: "News", slug: "news" });
    await insertFormRow(database, {
      handle: "contact",
      name: "Contact",
      fields: [],
      submitLabel: "Send",
      confirmation: {} as never,
      notifications: {} as never,
    });
    expect((await listTermRows(database, TENANT))[0]).toMatchObject({ slug: "news" });
    expect((await listFormVersions(database, TENANT))[0]?.handle).toBe("contact");
    expect(await listBlockVersions(database, TENANT)).toEqual([]);
  });
});
