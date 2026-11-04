import type { ShaderLibrary } from "@lintel/motion-editor";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { ApiError, apiRequest } from "../api/client.js";
import { useCan } from "../session/SessionContext.js";

interface SavedShaders {
  shaders: Array<{ id: string; name: string; code: string }>;
  allowed: boolean;
}

const shadersKey = ["website", "shaders"] as const;

/**
 * The site's own shaders for the builder's Motion panel. Undefined for people who can't
 * design pages. Writing them takes the code permission too, and the site allowing custom
 * code (see src/custom-shaders in core).
 */
export function useShaderLibraryForBuilder(): ShaderLibrary | undefined {
  const canDesign = useCan("builder:design");
  const canCode = useCan("builder:code");
  const canSetRule = useCan("settings:update");
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: shadersKey });
  const { data } = useQuery({
    queryKey: shadersKey,
    queryFn: () => apiRequest<SavedShaders>("/website/shaders"),
    enabled: canDesign,
    retry: false,
  });
  const removal = useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/website/shaders/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });
  const allowing = useMutation({
    mutationFn: () =>
      apiRequest("/pages/settings", {
        method: "PATCH",
        body: { customScripts: "allowScripts" },
      }),
    onSuccess: refresh,
  });
  const removeShader = removal.mutate;
  const allow = allowing.mutate;
  return useMemo(() => {
    if (!data) return undefined;
    return {
      shaders: data.shaders,
      allowed: data.allowed,
      canWrite: canDesign && canCode,
      async save({ id, name, code }) {
        try {
          await apiRequest(`/website/shaders/${id}`, { method: "PUT", body: { name, code } });
          await queryClient.invalidateQueries({ queryKey: shadersKey });
          return undefined;
        } catch (error) {
          return error instanceof ApiError ? error.message : String(error);
        }
      },
      remove: (id) => removeShader(id),
      ...(canSetRule ? { allowCode: () => allow() } : {}),
    };
  }, [data, canDesign, canCode, canSetRule, queryClient, removeShader, allow]);
}
