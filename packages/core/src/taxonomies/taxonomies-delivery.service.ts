import type { DatabaseOrTransaction } from "../database/client.js";
import type { Site } from "../sites/sites.table.js";
import { TermNotFoundError } from "./taxonomies.errors.js";
import { findTaxonomyOrFail } from "./taxonomies.service.js";
import { findTermBySlug, listTermsInTaxonomy, type TermWithTaxonomy } from "./terms.repository.js";

/**
 * Taxonomies for websites: the terms to build a category menu or a tag cloud from. To list
 * the entries with a term, ask the collection: `/delivery/posts?taxonomy=tags&term=recipes`.
 * A site sees the taxonomies every site shares and its own; another site's are a 404.
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
  site?: Site,
): Promise<{ handle: string; name: string; items: DeliveredTermDetails[] }> {
  const taxonomy = await findTaxonomyOrFail(database, handle, site);
  const terms = await listTermsInTaxonomy(database, taxonomy.id);
  return { handle: taxonomy.handle, name: taxonomy.name, items: terms.map(deliverTerm) };
}

export async function deliverTermBySlug(
  database: DatabaseOrTransaction,
  handle: string,
  slug: string,
  site?: Site,
): Promise<DeliveredTermDetails & { taxonomy: string }> {
  const taxonomy = await findTaxonomyOrFail(database, handle, site);
  const term = await findTermBySlug(database, taxonomy.id, slug);
  if (!term) {
    throw new TermNotFoundError();
  }
  return { ...deliverTerm(term), taxonomy: taxonomy.handle };
}
