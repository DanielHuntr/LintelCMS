import type { DatabaseOrTransaction } from "../database/client.js";
import { ensureTaxonomy, type TaxonomyDefaults } from "./taxonomies.service.js";

/**
 * The taxonomies the blog plugin starts with. Blog posts choose from them through their
 * Categories and Tags fields (see src/collections/default-collections.ts). Safe to run
 * again: existing taxonomies, and any terms people have changed, are left alone.
 */
export const categoriesTaxonomy: TaxonomyDefaults = {
  handle: "categories",
  name: "Categories",
  terms: ["News", "Guides", "Updates"],
};

export const tagsTaxonomy: TaxonomyDefaults = {
  handle: "tags",
  name: "Tags",
  terms: [],
};

export async function ensureBlogTaxonomies(database: DatabaseOrTransaction): Promise<void> {
  await ensureTaxonomy(database, categoriesTaxonomy);
  await ensureTaxonomy(database, tagsTaxonomy);
}
