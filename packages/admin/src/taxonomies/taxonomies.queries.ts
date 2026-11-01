import { useQuery } from "@tanstack/react-query";
import { getTaxonomy, listTaxonomies, listTerms } from "./taxonomies.api.js";

/** Cache keys for taxonomies. Terms nest under their taxonomy, so both refresh together. */
export const taxonomyKeys = {
  taxonomies: () => ["taxonomies"] as const,
  taxonomy: (handle: string) => ["taxonomies", handle] as const,
  terms: (handle: string) => ["taxonomies", handle, "terms"] as const,
};

export function useTaxonomies() {
  return useQuery({ queryKey: taxonomyKeys.taxonomies(), queryFn: listTaxonomies });
}

export function useTaxonomy(handle: string) {
  return useQuery({ queryKey: taxonomyKeys.taxonomy(handle), queryFn: () => getTaxonomy(handle) });
}

/** `handle` is undefined for a terms field that hasn't been given a taxonomy yet. */
export function useTerms(handle: string | undefined) {
  return useQuery({
    queryKey: taxonomyKeys.terms(handle ?? ""),
    queryFn: () => listTerms(handle ?? ""),
    enabled: handle !== undefined && handle !== "",
  });
}
