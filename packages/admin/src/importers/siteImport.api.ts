import { apiRequest } from "../api/client.js";

/** Calls to the API's site import routes (see packages/core/src/importers). */

export const siteImportSources = ["webflow", "framer", "statamic", "umbraco"] as const;
export type SiteImportSource = (typeof siteImportSources)[number];
export type SiteImportStatus = "ready" | "running" | "paused" | "complete";
export type SiteImportItemKind =
  "taxonomy" | "term" | "contentType" | "media" | "entry" | "menu" | "global";
export type SourceFieldKind =
  | "text"
  | "textarea"
  | "richText"
  | "markdown"
  | "number"
  | "toggle"
  | "date"
  | "image"
  | "images"
  | "url"
  | "email"
  | "colour"
  | "select"
  | "terms"
  | "entries"
  | "code"
  | "video"
  | "list"
  | "design";

export interface FoundContentType {
  key: string;
  name: string;
  handle: string;
  structure: "tree" | "dated" | "flat";
  entries: number;
  fields: Array<{ key: string; label: string; kind: SourceFieldKind }>;
}

export interface SiteImportFound {
  contentTypes: FoundContentType[];
  taxonomies: Array<{ key: string; name: string; handle: string; terms: number }>;
  media: number;
  menus: number;
  globals: number;
  notes: string[];
}

export interface ContentTypeMapping {
  collection: string | null;
  create: boolean;
  name: string;
  fields: Record<string, string | null>;
}

export interface SiteImportMapping {
  contentTypes: Record<string, ContentTypeMapping>;
  taxonomies: Record<string, string | null>;
  media: "import" | "skip";
  mediaHosts: string[];
  drafts: "import" | "skip";
  redirects: boolean;
  menus: boolean;
  globals: boolean;
}

export interface SiteImportReport {
  dryRun: boolean;
  counts: Record<SiteImportItemKind, { done: number; skipped: number; failed: number }>;
  createdTypes: string[];
  designedPages: string[];
  renamedSlugs: Array<{ title: string; from: string; to: string }>;
  redirectsSuggested: number;
  fieldsLeftOut: Array<{ title: string; fields: string[] }>;
  notes: string[];
  problems: Array<{ kind: SiteImportItemKind; title: string; message: string }>;
}

export interface SiteImport {
  id: string;
  source: SiteImportSource;
  filename: string;
  siteTitle: string;
  siteAddress: string;
  status: SiteImportStatus;
  found: SiteImportFound;
  mapping: SiteImportMapping | null;
  mediaHosts: string[];
  progress: { done: number; total: number };
  hasArchive: boolean;
  lastError: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface ExistingField {
  handle: string;
  label: string;
  type: string;
}

export interface SiteMappingChoices {
  import: SiteImport;
  collections: Array<{ handle: string; name: string; structure: string }>;
  collectionFields: Record<string, ExistingField[]>;
  taxonomies: Array<{ handle: string; name: string }>;
  suggested: SiteImportMapping;
}

const path = (importId: string, rest = "") =>
  `/site-imports/${encodeURIComponent(importId)}${rest}`;

export async function listSiteImports(source: SiteImportSource) {
  return (
    await apiRequest<{ imports: SiteImport[] }>(
      `/site-imports?source=${encodeURIComponent(source)}`,
    )
  ).imports;
}

export function getSiteImport(importId: string) {
  return apiRequest<SiteImport & { report: SiteImportReport | null }>(path(importId));
}

export function getSiteMappingChoices(importId: string) {
  return apiRequest<SiteMappingChoices>(path(importId, "/mapping"));
}

export function saveSiteMapping(importId: string, mapping: SiteImportMapping) {
  return apiRequest<{ mapping: SiteImportMapping }>(path(importId, "/mapping"), {
    method: "PUT",
    body: mapping,
  });
}

export function dryRunSiteImport(importId: string) {
  return apiRequest<SiteImportReport>(path(importId, "/dry-run"), { method: "POST" });
}

export function startSiteImport(importId: string) {
  return apiRequest<SiteImport>(path(importId, "/start"), { method: "POST" });
}
