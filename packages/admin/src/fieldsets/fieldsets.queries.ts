import { useQuery } from "@tanstack/react-query";
import { getFieldset, listFieldsets } from "./fieldsets.api.js";

export const fieldsetKeys = {
  fieldsets: () => ["fieldsets"] as const,
  fieldset: (handle: string) => ["fieldsets", handle] as const,
};

export function useFieldsets() {
  return useQuery({ queryKey: fieldsetKeys.fieldsets(), queryFn: listFieldsets });
}

export function useFieldset(handle: string) {
  return useQuery({
    queryKey: fieldsetKeys.fieldset(handle),
    queryFn: () => getFieldset(handle),
    // The builder keeps its own copy once it's open.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}
