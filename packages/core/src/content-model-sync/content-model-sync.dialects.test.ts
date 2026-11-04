import { expect, it } from "vitest";
import { insertTaxonomyIfMissing } from "../taxonomies/taxonomies.repository.js";
import { insertTerm } from "../taxonomies/terms.repository.js";
import { insertFieldsetIfMissing } from "../fieldsets/fieldsets.repository.js";
import { insertGlobalSetIfMissing } from "../globals/global-sets.repository.js";
import { upsertGlobalValues } from "../globals/global-values.repository.js";
import { insertNavigationIfMissing } from "../navigation/navigation.repository.js";
import { addTestEntry, describeOnEveryDatabase } from "../testing/every-database.js";
import {
  countEntriesWithParents,
  countTermsInTaxonomy,
  listBlueprintModelRows,
  listCollectionModelRows,
  listEntryIdsInCollection,
  listEntryValues,
  listFieldsetModelRows,
  listGlobalSetModelRows,
  listGlobalValueRows,
  listMenuModelRows,
  listTaxonomyModelRows,
  replaceEntryValues,
} from "./content-model-sync.repository.js";

const TENANT = "default";

describeOnEveryDatabase("Content model reads", (handle) => {
  it("reads every kind of model row", async () => {
    const { database } = handle;
    const entry = await addTestEntry(database);
    const taxonomy = await insertTaxonomyIfMissing(database, { handle: "tags", name: "Tags" });
    const taxonomyId = taxonomy?.id ?? "";
    await insertTerm(database, { taxonomyId, title: "News", slug: "news" });
    await insertFieldsetIfMissing(database, { handle: "seo", name: "SEO" });
    const set = await insertGlobalSetIfMissing(database, { handle: "footer", name: "Footer" });
    const globalSetId = set?.id ?? "";
    await upsertGlobalValues(database, {
      globalSetId,
      siteId: entry.siteId,
      locale: "en",
      data: { a: 1 },
      updatedBy: null,
    });
    await insertNavigationIfMissing(database, {
      siteId: entry.siteId,
      handle: "main",
      name: "Main",
    });

    expect(await listBlueprintModelRows(database, TENANT)).toHaveLength(1);
    expect(await listCollectionModelRows(database, TENANT)).toHaveLength(1);
    expect(await listTaxonomyModelRows(database, TENANT)).toHaveLength(1);
    expect(await listGlobalSetModelRows(database, TENANT)).toHaveLength(1);
    expect(await listMenuModelRows(database, TENANT)).toHaveLength(1);
    expect(await listFieldsetModelRows(database, TENANT)).toHaveLength(1);
    expect(await listGlobalValueRows(database, globalSetId)).toHaveLength(1);
    expect(await countTermsInTaxonomy(database, taxonomyId)).toBe(1);
  });

  it("reads and replaces entry values", async () => {
    const { database } = handle;
    const entry = await addTestEntry(database, { data: { a: 1 } });
    const child = await addTestEntry(database, { slug: "child", parentId: entry.id });
    expect(await listEntryValues(database, [])).toEqual([]);
    expect(await countEntriesWithParents(database, entry.collectionId)).toBe(1);
    const ids = await listEntryIdsInCollection(database, entry.collectionId);
    expect(ids.sort()).toEqual([entry.id, child.id].sort());

    await replaceEntryValues(database, entry.id, { data: { a: 2 }, publishedData: null });
    const values = await listEntryValues(database, [entry.collectionId]);
    expect(values.find((row) => row.id === entry.id)).toMatchObject({
      data: { a: 2 },
      publishedData: null,
    });
  });
});
