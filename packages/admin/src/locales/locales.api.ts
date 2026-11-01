import { apiRequest } from "../api/client.js";
import type { Locale, LocaleList } from "./locales.types.js";

/** Calls to the API's locale routes. One function per route. */

export function listLocales(): Promise<LocaleList> {
  return apiRequest<LocaleList>("/locales");
}

export function addLocale(locale: { code: string; name?: string }): Promise<Locale> {
  return apiRequest<Locale>("/locales", { method: "POST", body: locale });
}

export function renameLocale(code: string, name: string): Promise<Locale> {
  return apiRequest<Locale>(`/locales/${encodeURIComponent(code)}`, {
    method: "PATCH",
    body: { name },
  });
}

export function removeLocale(code: string): Promise<void> {
  return apiRequest<void>(`/locales/${encodeURIComponent(code)}`, { method: "DELETE" });
}
