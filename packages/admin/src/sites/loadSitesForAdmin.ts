import type { QueryClient } from "@tanstack/react-query";
import { chooseCurrentSite } from "./currentSite.js";
import { listSites } from "./sites.api.js";
import { siteKeys } from "./sites.queries.js";
import type { Site } from "./sites.types.js";

/**
 * Loads the sites someone may work on and settles which one requests are for, before any
 * admin screen asks for content. Called by the router once a session is known.
 */
export async function loadSitesForAdmin(queryClient: QueryClient): Promise<Site[]> {
  const sites = await queryClient.fetchQuery({
    queryKey: siteKeys.sites(),
    queryFn: listSites,
    staleTime: 60_000,
  });
  chooseCurrentSite(sites);
  return sites;
}
