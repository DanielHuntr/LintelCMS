import { apiRequest } from "../api/client.js";

/** Calls to the SEO plugin's routes (see packages/core/src/seo). */

export interface SeoDefaults {
  siteName: string;
  siteUrl: string;
  titleTemplate: string;
  defaultDescription: string;
  defaultSocialImageId: string | null;
  discourageSearchEngines: boolean;
}

export interface EntrySeo {
  title: string;
  description: string;
  socialImageId: string | null;
  noindex: boolean;
}

export type RedirectStatusCode = 301 | 302;

export interface Redirect {
  id: string;
  fromPath: string;
  toPath: string;
  statusCode: RedirectStatusCode;
  status: "active" | "suggested";
  source: "manual" | "import" | "automatic";
  entryId: string | null;
  updatedAt: string;
}

export interface RedirectImportResult {
  added: number;
  updated: number;
  problems: { line: number; message: string }[];
}

export function getSeoDefaults() {
  return apiRequest<SeoDefaults>("/seo/defaults");
}

export function updateSeoDefaults(changes: Partial<SeoDefaults>) {
  return apiRequest<SeoDefaults>("/seo/defaults", { method: "PUT", body: changes });
}

export function getEntrySeo(entryId: string) {
  return apiRequest<EntrySeo>(`/seo/entries/${encodeURIComponent(entryId)}`);
}

export function saveEntrySeo(entryId: string, seo: EntrySeo) {
  return apiRequest<EntrySeo>(`/seo/entries/${encodeURIComponent(entryId)}`, {
    method: "PUT",
    body: seo,
  });
}

export async function listRedirects(): Promise<Redirect[]> {
  const { redirects } = await apiRequest<{ redirects: Redirect[] }>("/seo/redirects");
  return redirects;
}

export function createRedirect(redirect: {
  fromPath: string;
  toPath: string;
  statusCode: RedirectStatusCode;
}) {
  return apiRequest<Redirect>("/seo/redirects", { method: "POST", body: redirect });
}

export function updateRedirect(
  redirectId: string,
  changes: Partial<Pick<Redirect, "fromPath" | "toPath" | "statusCode">> & { status?: "active" },
) {
  return apiRequest<Redirect>(`/seo/redirects/${encodeURIComponent(redirectId)}`, {
    method: "PATCH",
    body: changes,
  });
}

export function deleteRedirect(redirectId: string) {
  return apiRequest<void>(`/seo/redirects/${encodeURIComponent(redirectId)}`, {
    method: "DELETE",
  });
}

export function importRedirects(csv: string) {
  return apiRequest<RedirectImportResult>("/seo/redirects/import", {
    method: "POST",
    body: { csv },
  });
}
