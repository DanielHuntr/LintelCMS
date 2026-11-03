import { useQuery } from "@tanstack/react-query";
import { checkServer } from "./serverCheck.api.js";

export const serverCheckKeys = { report: () => ["server-check"] as const };

/** The check tries the internet and the database, so it runs when asked, not in the background. */
export function useServerCheck() {
  return useQuery({
    queryKey: serverCheckKeys.report(),
    queryFn: checkServer,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
