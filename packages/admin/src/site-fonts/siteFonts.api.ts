import { apiRequest, apiUrl } from "../api/client.js";
import { siteHeaders } from "../sites/currentSite.js";

/** Calls to the site's fonts (see packages/core/src/site-fonts). */

export type FontCategory = "sans" | "serif" | "display" | "script" | "mono";
export type FontStyle = "normal" | "italic";

export interface SiteFont {
  id: string;
  family: string;
  category: FontCategory;
  source: "upload" | "google" | "adobe";
  sourceId: string | null;
  files: Array<{ assetId: string; url: string; weight: string; style: FontStyle; format: string }>;
  weights: string[];
  hasItalic: boolean;
}

export interface SiteFonts {
  fonts: SiteFont[];
  adobeProjects: Array<{ projectId: string; stylesheetUrl: string; families: string[] }>;
}

export interface InspectedFontFile {
  assetId: string;
  filename: string;
  family: string;
  weight: string;
  style: FontStyle;
  readFromFile: boolean;
}

export interface GoogleFont {
  id: string;
  family: string;
  category: FontCategory;
  weights: string[];
  hasItalic: boolean;
}

export interface UploadedFontRequest {
  family: string;
  category: FontCategory;
  files: Array<{ assetId: string; weight: string; style: FontStyle }>;
  licenceConfirmed: true;
}

export function getSiteFonts() {
  return apiRequest<SiteFonts>("/site-fonts");
}

export function inspectFontFiles(assetIds: string[]) {
  return apiRequest<{ files: InspectedFontFile[] }>("/site-fonts/inspect", {
    method: "POST",
    body: { assetIds },
  });
}

export function addUploadedFont(request: UploadedFontRequest) {
  return apiRequest<SiteFont>("/site-fonts/uploaded", { method: "POST", body: request });
}

export function searchGoogleFonts(search: string, category: FontCategory | "") {
  const query = new URLSearchParams();
  if (search) query.set("search", search);
  if (category) query.set("category", category);
  return apiRequest<{ fonts: GoogleFont[]; total: number }>(`/site-fonts/google?${query}`);
}

export function addGoogleFont(id: string, weights: string[], italic: boolean) {
  return apiRequest<SiteFont>("/site-fonts/google", {
    method: "POST",
    body: { id, weights, italic },
  });
}

export function connectAdobeProject(projectId: string) {
  return apiRequest<SiteFonts>("/site-fonts/adobe", { method: "POST", body: { projectId } });
}

export function disconnectAdobeProject(projectId: string) {
  return apiRequest<SiteFonts>(`/site-fonts/adobe/${encodeURIComponent(projectId)}`, {
    method: "DELETE",
  });
}

export function removeSiteFont(fontId: string) {
  return apiRequest<undefined>(`/site-fonts/${encodeURIComponent(fontId)}`, { method: "DELETE" });
}

/**
 * A font file's bytes, for previews: a Google Fonts family through Lintel (it needs the
 * session cookie), or a site font's own file from the media library.
 */
export async function loadFontFile(url: string, withSession: boolean): Promise<ArrayBuffer> {
  // Media files are public and answer any address; Google previews need the session.
  const response = withSession
    ? await fetch(url, { credentials: "include", headers: siteHeaders() })
    : await fetch(url, { credentials: "omit" });
  if (!response.ok) throw new Error(`The font answered ${response.status}`);
  return response.arrayBuffer();
}

export function googlePreviewUrl(fontId: string): string {
  return `${apiUrl}/site-fonts/google/${encodeURIComponent(fontId)}/preview`;
}
