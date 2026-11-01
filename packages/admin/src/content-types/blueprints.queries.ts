import { useQuery } from "@tanstack/react-query";
import { getBlueprint, listBlueprints, listFieldtypes } from "./blueprints.api.js";

export const blueprintKeys = {
  blueprints: () => ["blueprints"] as const,
  blueprint: (handle: string) => ["blueprints", handle] as const,
  fieldtypes: () => ["fieldtypes"] as const,
};

export function useBlueprints() {
  return useQuery({ queryKey: blueprintKeys.blueprints(), queryFn: listBlueprints });
}

/** `handle` is undefined while it isn't known yet (the collection is still loading). */
export function useBlueprint(handle: string | undefined) {
  return useQuery({
    queryKey: blueprintKeys.blueprint(handle ?? ""),
    queryFn: () => getBlueprint(handle ?? ""),
    enabled: handle !== undefined,
    // Like the entry editor, the builder keeps its own copy once it's open.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function useFieldtypes() {
  // The list of fieldtypes only changes when Lintel is upgraded.
  return useQuery({
    queryKey: blueprintKeys.fieldtypes(),
    queryFn: listFieldtypes,
    staleTime: Infinity,
  });
}
