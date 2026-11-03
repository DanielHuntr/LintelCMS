import type {
  AppDevelopmentMode,
  AppExtensions,
  AppPreview,
  AppResponse,
  AppScope,
  AppSessionToken,
  InstalledApp,
} from "@lintel/core";
import { apiRequest } from "../api/client.js";

/** Calls to the API's app routes (see packages/core/src/apps). */

export type { AppDevelopmentMode, AppExtensions, AppPreview, AppResponse, AppScope, InstalledApp };
export type AppManifest = AppPreview["manifest"];

/** Where the app's details come from: its `lintel-app.json` address, or the file pasted in. */
export type ManifestSource = { manifestUrl: string } | { manifest: unknown };

export async function listApps(): Promise<AppResponse[]> {
  const { apps } = await apiRequest<{ apps: AppResponse[] }>("/apps");
  return apps;
}

export function getApp(appId: string) {
  return apiRequest<AppResponse>(`/apps/${appId}`);
}

export function previewApp(source: ManifestSource) {
  return apiRequest<AppPreview>("/apps/preview", { method: "POST", body: source });
}

export function installApp(install: ManifestSource & { approvedScopes: AppScope[] }) {
  return apiRequest<InstalledApp>("/apps", { method: "POST", body: install });
}

export function uninstallApp(appId: string) {
  return apiRequest<void>(`/apps/${appId}`, { method: "DELETE" });
}

export function getAppDevelopmentMode() {
  return apiRequest<AppDevelopmentMode>("/apps/development-mode");
}

export function setAppDevelopmentMode(on: boolean) {
  return apiRequest<AppDevelopmentMode>("/apps/development-mode", {
    method: "PUT",
    body: { on },
  });
}

export async function listAppExtensions(): Promise<AppExtensions[]> {
  const { apps } = await apiRequest<{ apps: AppExtensions[] }>("/apps/extensions");
  return apps;
}

export function fetchSessionToken(appId: string) {
  return apiRequest<AppSessionToken>(`/apps/${appId}/session-token`, { method: "POST" });
}
