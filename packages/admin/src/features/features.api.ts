import { apiRequest } from "../api/client.js";

/**
 * Calls to the API's plugin routes (see packages/core/src/plugins). Plugins are called
 * "features" everywhere people see them.
 */

/** One plugin, as `GET /plugins` lists it. */
export interface Feature {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  source: "built-in" | "installed";
  version: string | null;
  permissions: Array<{ permission: string; description: string }>;
  hasSettings: boolean;
}

export async function listFeatures(): Promise<Feature[]> {
  return (await apiRequest<{ plugins: Feature[] }>("/plugins")).plugins;
}

/** Switches on exactly these features and off the rest; answers with the new list. */
export async function saveEnabledFeatures(enabled: readonly string[]): Promise<Feature[]> {
  const body = { enabled };
  return (await apiRequest<{ plugins: Feature[] }>("/plugins", { method: "PUT", body })).plugins;
}
