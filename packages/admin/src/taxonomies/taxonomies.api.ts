import { apiRequest } from "../api/client.js";
import type { Taxonomy, Term, TermChanges } from "./taxonomies.types.js";

/** Calls to the content API's taxonomy and term routes. One function per route. */

export async function listTaxonomies(): Promise<Taxonomy[]> {
  const { taxonomies } = await apiRequest<{ taxonomies: Taxonomy[] }>("/taxonomies");
  return taxonomies;
}

export function getTaxonomy(handle: string): Promise<Taxonomy> {
  return apiRequest<Taxonomy>(`/taxonomies/${encodeURIComponent(handle)}`);
}

export function createTaxonomy(taxonomy: {
  handle: string;
  name: string;
  /** The site it belongs to; null (or left out) for one every site shares. */
  siteHandle?: string | null;
}): Promise<Taxonomy> {
  return apiRequest<Taxonomy>("/taxonomies", { method: "POST", body: taxonomy });
}

export function renameTaxonomy(handle: string, name: string): Promise<Taxonomy> {
  return apiRequest<Taxonomy>(`/taxonomies/${encodeURIComponent(handle)}`, {
    method: "PUT",
    body: { name },
  });
}

export function deleteTaxonomy(handle: string): Promise<void> {
  return apiRequest<void>(`/taxonomies/${encodeURIComponent(handle)}`, { method: "DELETE" });
}

export async function listTerms(taxonomyHandle: string): Promise<Term[]> {
  const { terms } = await apiRequest<{ terms: Term[] }>(
    `/taxonomies/${encodeURIComponent(taxonomyHandle)}/terms`,
  );
  return terms;
}

export function createTerm(taxonomyHandle: string, term: TermChanges): Promise<Term> {
  return apiRequest<Term>(`/taxonomies/${encodeURIComponent(taxonomyHandle)}/terms`, {
    method: "POST",
    body: withoutBlankSlug(term),
  });
}

export function updateTerm(termId: string, changes: TermChanges): Promise<Term> {
  return apiRequest<Term>(`/terms/${termId}`, {
    method: "PATCH",
    body: withoutBlankSlug(changes),
  });
}

export function deleteTerm(termId: string): Promise<void> {
  return apiRequest<void>(`/terms/${termId}`, { method: "DELETE" });
}

/** A blank slug lets the API make one from the title. */
function withoutBlankSlug(term: TermChanges): TermChanges {
  return term.slug?.trim() ? term : { ...term, slug: undefined };
}
