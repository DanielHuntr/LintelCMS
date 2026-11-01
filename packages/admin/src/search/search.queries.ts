import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { searchEverything } from "./search.api.js";

/** Results for a (settled) query. Nothing is asked for until there is something to look for. */
export function useSearchResults(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ["search", trimmed] as const,
    queryFn: () => searchEverything(trimmed),
    enabled: trimmed !== "",
    // Keep the last results on screen while the next ones arrive, so the list doesn't flash.
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  });
}
