import { useQuery } from "@tanstack/react-query";
import { listLiquidTemplates } from "./liquidTemplates.api.js";

export const liquidTemplateKeys = {
  all: () => ["website", "liquid-templates"] as const,
};

/** The page templates there are; an empty list for an install without a templates folder. */
export function useLiquidTemplates() {
  return useQuery({
    queryKey: liquidTemplateKeys.all(),
    queryFn: listLiquidTemplates,
    staleTime: 30_000,
  });
}
