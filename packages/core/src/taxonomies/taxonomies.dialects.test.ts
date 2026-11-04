import { expect, it } from "vitest";
import type { Database } from "../database/client.js";
import { describeOnEveryDatabase } from "../testing/every-database.js";
import {
  deleteTaxonomyRow,
  findTaxonomyByHandle,
  findTaxonomyById,
  findTaxonomyWithCount,
  insertTaxonomyIfMissing,
  listTaxonomiesWithCounts,
  updateTaxonomyRow,
} from "./taxonomies.repository.js";
import {
  deleteTermRow,
  findTermById,
  findTermBySlug,
  findTermIdsInTaxonomy,
  findTermSlugsStartingWith,
  findTermsByIds,
  insertTerm,
  insertTermIfMissing,
  listTermIdsInTaxonomy,
  listTermsInTaxonomy,
  updateTermRow,
} from "./terms.repository.js";

const TENANT = "default";

async function addTaxonomy(database: Database) {
  const taxonomy = await insertTaxonomyIfMissing(database, { handle: "tags", name: "Tags" });
  if (!taxonomy) throw new Error("The taxonomy was not saved.");
  return taxonomy;
}

describeOnEveryDatabase("Taxonomies", (handle) => {
  it("adds a taxonomy once, counts its terms, changes and deletes it", async () => {
    const { database } = handle;
    const taxonomy = await addTaxonomy(database);
    expect(await insertTaxonomyIfMissing(database, { handle: "tags", name: "x" })).toBe(undefined);
    await insertTerm(database, { taxonomyId: taxonomy.id, title: "News", slug: "news" });

    expect((await listTaxonomiesWithCounts(database, TENANT))[0]?.termCount).toBe(1);
    expect((await findTaxonomyWithCount(database, TENANT, "tags"))?.termCount).toBe(1);
    expect((await findTaxonomyByHandle(database, TENANT, "tags"))?.id).toBe(taxonomy.id);

    await updateTaxonomyRow(database, taxonomy.id, { name: "Labels" });
    expect((await findTaxonomyById(database, taxonomy.id))?.name).toBe("Labels");
    await deleteTaxonomyRow(database, taxonomy.id);
    expect(await listTaxonomiesWithCounts(database, TENANT)).toEqual([]);
  });
});

describeOnEveryDatabase("Terms", (handle) => {
  it("lists terms alphabetically, whatever their case", async () => {
    const { database } = handle;
    const { id: taxonomyId } = await addTaxonomy(database);
    await insertTerm(database, { taxonomyId, title: "banana", slug: "banana" });
    await insertTerm(database, { taxonomyId, title: "Cherry", slug: "cherry" });
    await insertTerm(database, { taxonomyId, title: "apple", slug: "apple" });
    const rows = await listTermsInTaxonomy(database, taxonomyId);
    expect(rows.map((row) => row.title)).toEqual(["apple", "banana", "Cherry"]);
    expect(rows[0]?.taxonomyHandle).toBe("tags");
  });

  it("finds terms by id, slug and taxonomy", async () => {
    const { database } = handle;
    const { id: taxonomyId } = await addTaxonomy(database);
    const term = await insertTerm(database, { taxonomyId, title: "News", slug: "news" });
    await insertTermIfMissing(database, { taxonomyId, title: "Again", slug: "news" });
    await insertTerm(database, { taxonomyId, title: "News", slug: "news-2" });

    expect((await findTermById(database, term.id))?.title).toBe("News");
    expect((await findTermBySlug(database, taxonomyId, "news"))?.id).toBe(term.id);
    expect(await findTermsByIds(database, [term.id])).toHaveLength(1);
    expect(await findTermIdsInTaxonomy(database, "tags", [term.id])).toEqual([term.id]);
    expect(await listTermIdsInTaxonomy(database, taxonomyId)).toHaveLength(2);
    const slugs = await findTermSlugsStartingWith(database, taxonomyId, "news");
    expect(slugs.sort()).toEqual(["news", "news-2"]);
  });

  it("changes and deletes a term", async () => {
    const { database } = handle;
    const { id: taxonomyId } = await addTaxonomy(database);
    const term = await insertTerm(database, { taxonomyId, title: "News", slug: "news" });
    await updateTermRow(database, term.id, { title: "Updates" });
    expect((await findTermById(database, term.id))?.title).toBe("Updates");
    await deleteTermRow(database, term.id);
    expect(await findTermById(database, term.id)).toBeUndefined();
  });
});
