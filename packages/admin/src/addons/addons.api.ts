import { apiRequest, apiUrl } from "../api/client.js";

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

/** `GET /addons/:id/details`: see AddonDetails in core's src/addons/addons.schema.ts. */
export interface AddonDetails {
  id: string;
  stores: {
    tables: Array<{
      name: string;
      purpose: string;
      columns: Array<{ name: string; purpose: string; personalData: boolean; checked: boolean }>;
      checked: boolean;
      rows: number | null;
      bytes: number | null;
    }>;
    undeclared: Array<{ name: string; rows: number | null; bytes: number | null }>;
    settings: boolean;
  };
  website: {
    publicRoutes: Array<{ method: string; path: string; purpose: string; checked: boolean }>;
    otherRoutes: number;
    adminScreens: boolean;
    blocks: string[];
  };
  runs: {
    jobs: Array<{
      id: string;
      name: string;
      everyMinutes: number | null;
      purpose: string | null;
      lastRunAt: string | null;
      lastError: string | null;
      checked: boolean;
    }>;
    events: Array<{ event: string; purpose: string | null; checked: boolean }>;
  };
  talksTo: {
    hosts: Array<{ host: string; purpose: string }>;
    consentServices: string[];
    consentFromSettings: boolean;
  };
  origin: {
    packageName: string | null;
    version: string | null;
    publisher: string | null;
    licence: string | null;
    source: string | null;
    integrity: string | null;
    fingerprint: string | null;
  };
  permissions: Array<{ permission: string; description: string }>;
}

export function getAddonDetails(addonId: string): Promise<AddonDetails> {
  return apiRequest<AddonDetails>(`/addons/${encodeURIComponent(addonId)}/details`);
}

/** Its data to download: every table as JSON, or one table as CSV. */
export function addonExportUrl(addonId: string, table?: string): string {
  const query = new URLSearchParams(table ? { format: "csv", table } : { format: "json" });
  return `${apiUrl}/addons/${encodeURIComponent(addonId)}/export?${query}`;
}

export function deleteAddonData(addonId: string): Promise<{ emptied: string[] }> {
  return apiRequest<{ emptied: string[] }>(`/addons/${encodeURIComponent(addonId)}/delete-data`, {
    method: "POST",
    body: { confirm: "DELETE" },
  });
}
