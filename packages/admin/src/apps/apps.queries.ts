import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getApp,
  getAppDevelopmentMode,
  installApp,
  listAppExtensions,
  listApps,
  previewApp,
  setAppDevelopmentMode,
  uninstallApp,
} from "./apps.api.js";

export const appKeys = {
  all: () => ["apps"] as const,
  list: () => ["apps", "list"] as const,
  detail: (appId: string) => ["apps", "detail", appId] as const,
  extensions: () => ["apps", "extensions"] as const,
  developmentMode: () => ["apps", "development-mode"] as const,
};

export function useApps() {
  return useQuery({ queryKey: appKeys.list(), queryFn: listApps });
}

export function useApp(appId: string) {
  return useQuery({ queryKey: appKeys.detail(appId), queryFn: () => getApp(appId) });
}

/** Every installed app's pages, widgets and panels. Changes only when apps are (un)installed. */
export function useAppExtensions() {
  return useQuery({
    queryKey: appKeys.extensions(),
    queryFn: listAppExtensions,
    staleTime: 5 * 60_000,
  });
}

/** Apps' development mode: whether this server allows it, and whether it is on. */
export function useAppDevelopmentMode() {
  return useQuery({ queryKey: appKeys.developmentMode(), queryFn: getAppDevelopmentMode });
}

export function useSetAppDevelopmentMode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setAppDevelopmentMode,
    onSuccess: (mode) => queryClient.setQueryData(appKeys.developmentMode(), mode),
  });
}

export function usePreviewApp() {
  return useMutation({ mutationFn: previewApp });
}

export function useInstallApp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: installApp,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: appKeys.all() }),
  });
}

export function useUninstallApp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: uninstallApp,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: appKeys.all() }),
  });
}
