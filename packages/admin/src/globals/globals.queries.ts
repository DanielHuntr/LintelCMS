import { useQuery } from "@tanstack/react-query";
import { getGlobalSet, listGlobalSets } from "./globals.api.js";

export const globalKeys = {
  globalSets: () => ["globals"] as const,
  globalSet: (handle: string, locale: string | undefined) =>
    ["globals", handle, locale ?? "default"] as const,
};

export function useGlobalSets() {
  return useQuery({ queryKey: globalKeys.globalSets(), queryFn: listGlobalSets });
}

export function useGlobalSet(handle: string, locale: string | undefined) {
  return useQuery({
    queryKey: globalKeys.globalSet(handle, locale),
    queryFn: () => getGlobalSet(handle, locale),
    // Like the entry editor, the form keeps its own copy while it's open.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}
