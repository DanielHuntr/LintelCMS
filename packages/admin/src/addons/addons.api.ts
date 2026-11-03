import { apiRequest } from "../api/client.js";

/** Calls to the API's add-on routes (see packages/core/src/addons). */

export const addonKeys = { all: () => ["addons"] as const };

export type AddonPart =
  | "fieldtypes"
  | "blocks"
  | "liquid"
  | "events"
  | "jobs"
  | "commands"
  | "routes"
  | "tables"
  | "settings"
  | "admin";

/** One add-on, as `GET /addons` lists it. `problem` is set for one that couldn't run. */
export interface Addon {
  id: string | null;
  name: string;
  description: string;
  packageName: string | null;
  version: string | null;
  from: "npm" | "folder" | "config";
  enabled: boolean;
  adds: AddonPart[];
  permissions: Array<{ permission: string; description: string }>;
  settingsSchema: Record<string, unknown> | null;
  problem: string | null;
}

export interface AddonList {
  addons: Addon[];
  folder: string | null;
}

export function listAddons(): Promise<AddonList> {
  return apiRequest<AddonList>("/addons");
}

export function readAddonSettings(addonId: string): Promise<Record<string, unknown>> {
  return apiRequest<Record<string, unknown>>(`/plugins/${encodeURIComponent(addonId)}/settings`);
}

export function saveAddonSettings(
  addonId: string,
  settings: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return apiRequest<Record<string, unknown>>(`/plugins/${encodeURIComponent(addonId)}/settings`, {
    method: "PUT",
    body: settings,
  });
}

/** The admin halves to load when the admin starts. */
export interface AddonAdminScripts {
  scripts: Array<{ id: string; script: string; styles: string | null }>;
}

export function listAdminScripts(): Promise<AddonAdminScripts> {
  return apiRequest<AddonAdminScripts>("/addons/admin-scripts");
}
