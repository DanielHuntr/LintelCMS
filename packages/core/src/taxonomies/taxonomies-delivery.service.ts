import type { DatabaseOrTransaction } from "../database/client.js";
import { TermNotFoundError } from "./taxonomies.errors.js";
import { findTaxonomyOrFail } from "./taxonomies.service.js";
import { findTermBySlug, listTermsInTaxonomy, type TermWithTaxonomy } from "./terms.repository.js";

/**
 * Taxonomies for websites: the terms to build a category menu or a tag cloud from. To list
 * the entries with a term, ask the collection: `/delivery/posts?taxonomy=tags&term=recipes`.
 */

export interface DeliveredTermDetails {
  id: string;
  title: string;
  slug: string;
  description: string;
}

function deliverTerm(term: TermWithTaxonomy): DeliveredTermDetails {
  return { id: term.id, title: term.title, slug: term.slug, description: term.description };
}

export async function deliverTaxonomy(
  database: DatabaseOrTransaction,
  handle: string,
): Promise<{ handle: string; name: string; items: DeliveredTermDetails[] }> {
  const taxonomy = await findTaxonomyOrFail(database, handle);
  const terms = await listTermsInTaxonomy(database, taxonomy.id);
  return { handle: taxonomy.handle, name: taxonomy.name, items: terms.map(deliverTerm) };
}

export async function deliverTermBySlug(
  database: DatabaseOrTransaction,
  handle: string,
  slug: string,
): Promise<DeliveredTermDetails & { taxonomy: string }> {
  const taxonomy = await findTaxonomyOrFail(database, handle);
  const term = await findTermBySlug(database, taxonomy.id, slug);
  if (!term) {
    throw new TermNotFoundError();
  }
  return { ...deliverTerm(term), taxonomy: taxonomy.handle };
}
