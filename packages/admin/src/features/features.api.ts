import { apiRequest } from "../api/client.js";
import type { Plugin } from "../setup/setup.api.js";

/** Calls to the API's plugin routes. Plugins are called "features" everywhere people see them. */

export async function listFeatures(): Promise<Plugin[]> {
  const { plugins } = await apiRequest<{ plugins: Plugin[] }>("/plugins");
  return plugins;
}

/** Switches on exactly these features and off the rest; answers with the new list. */
export async function saveEnabledFeatures(enabled: readonly string[]): Promise<Plugin[]> {
  const { plugins } = await apiRequest<{ plugins: Plugin[] }>("/plugins", {
    method: "PUT",
    body: { enabled },
  });
  return plugins;
}
