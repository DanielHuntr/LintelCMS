import { useQuery } from "@tanstack/react-query";
import { listAllCollections, listRoleSiteAccess, listSites } from "./sites.api.js";

export const siteKeys = {
  sites: () => ["sites"] as const,
  roleAccess: () => ["sites", "access"] as const,
  allCollections: () => ["sites", "collections"] as const,
};

/** The sites the signed-in person may work on. */
export function useSites() {
  return useQuery({ queryKey: siteKeys.sites(), queryFn: listSites, staleTime: 60_000 });
}

export function useRoleSiteAccess() {
  return useQuery({ queryKey: siteKeys.roleAccess(), queryFn: listRoleSiteAccess });
}

export function useAllCollections() {
  return useQuery({ queryKey: siteKeys.allCollections(), queryFn: listAllCollections });
}
