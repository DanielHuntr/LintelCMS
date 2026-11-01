import { apiRequest } from "../api/client.js";
import type { EntryData, Field } from "../fields/field.types.js";
import type { GlobalSet, GlobalSetSummary } from "./globals.types.js";

/** Calls to the API's global set routes. One function per route. */

export async function listGlobalSets(): Promise<GlobalSetSummary[]> {
  const { globals } = await apiRequest<{ globals: GlobalSetSummary[] }>("/globals");
  return globals;
}

function globalSetPath(handle: string, locale?: string): string {
  const query = locale ? `?locale=${encodeURIComponent(locale)}` : "";
  return `/globals/${encodeURIComponent(handle)}${query}`;
}

export function getGlobalSet(handle: string, locale?: string): Promise<GlobalSet> {
  return apiRequest<GlobalSet>(globalSetPath(handle, locale));
}

export function createGlobalSet(globalSet: { handle: string; name: string }): Promise<GlobalSet> {
  return apiRequest<GlobalSet>("/globals", { method: "POST", body: globalSet });
}

export function updateGlobalSet(
  handle: string,
  changes: { name: string; fields: Field[] },
): Promise<GlobalSet> {
  return apiRequest<GlobalSet>(globalSetPath(handle), { method: "PUT", body: changes });
}

export function saveGlobalValues(
  handle: string,
  locale: string | undefined,
  data: EntryData,
): Promise<GlobalSet> {
  const query = locale ? `?locale=${encodeURIComponent(locale)}` : "";
  return apiRequest<GlobalSet>(`/globals/${encodeURIComponent(handle)}/values${query}`, {
    method: "PATCH",
    body: { data },
  });
}

export function deleteGlobalSet(handle: string): Promise<void> {
  return apiRequest<void>(globalSetPath(handle), { method: "DELETE" });
}
