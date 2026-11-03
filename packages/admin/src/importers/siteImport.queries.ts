import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  dryRunSiteImport,
  getSiteImport,
  getSiteMappingChoices,
  listSiteImports,
  saveSiteMapping,
  type SiteImportMapping,
  type SiteImportSource,
  startSiteImport,
} from "./siteImport.api.js";

export const siteImportKeys = {
  list: (source: SiteImportSource) => ["site-imports", source] as const,
  one: (importId: string) => ["site-imports", "one", importId] as const,
  mapping: (importId: string) => ["site-imports", "one", importId, "mapping"] as const,
};

export function useSiteImports(source: SiteImportSource) {
  return useQuery({
    queryKey: siteImportKeys.list(source),
    queryFn: () => listSiteImports(source),
  });
}

/** Refreshes every second or two while the import runs, for the progress bar. */
export function useSiteImport(importId: string) {
  return useQuery({
    queryKey: siteImportKeys.one(importId),
    queryFn: () => getSiteImport(importId),
    refetchInterval: (query) => (query.state.data?.status === "running" ? 1500 : false),
  });
}

export function useSiteMappingChoices(importId: string) {
  return useQuery({
    queryKey: siteImportKeys.mapping(importId),
    queryFn: () => getSiteMappingChoices(importId),
  });
}

export function useSaveSiteMapping(importId: string) {
  return useMutation({
    mutationFn: (mapping: SiteImportMapping) => saveSiteMapping(importId, mapping),
  });
}

export function useSiteDryRun(importId: string) {
  return useMutation({ mutationFn: () => dryRunSiteImport(importId) });
}

export function useStartSiteImport(importId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => startSiteImport(importId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: siteImportKeys.one(importId) }),
  });
}
