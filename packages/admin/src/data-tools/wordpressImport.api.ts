import { apiRequest } from "../api/client.js";

/** Calls to the API's WordPress import routes (see packages/core/src/wordpress-import). */

export type WordPressImportStatus = "ready" | "running" | "paused" | "complete";
export type WordPressItemKind =
  "author" | "category" | "tag" | "attachment" | "image" | "page" | "post" | "product" | "menu";

export interface WordPressCustomField {
  key: string;
  example: string;
  fromAcf: boolean;
  count: number;
}

export interface WordPressImportMapping {
  postsCollection: string | null;
  pagesCollection: string | null;
  categoriesTaxonomy: string | null;
  tagsTaxonomy: string | null;
  media: "download" | "zip" | "skip";
  /** Other hosts images may be downloaded from, besides the old site's own. */
  mediaHosts: string[];
  authors: "invite" | "skip";
  drafts: "import" | "skip";
  redirects: boolean;
  /** Custom field key → the field it goes into, or null to leave it out. */
  postFields: Record<string, string | null>;
  pageFields: Record<string, string | null>;
  menus: boolean;
  products: "import" | "skip";
}

export interface WordPressFieldMapping {
  title: string;
  body: string | null;
  excerpt: string | null;
  featuredImage: string | null;
  categories: string | null;
  tags: string | null;
}

export interface WordPressImportReport {
  dryRun: boolean;
  counts: Record<WordPressItemKind, { done: number; skipped: number; failed: number }>;
  invitedPeople: Array<{ name: string; email: string }>;
  keptAsHtml: Record<string, number>;
  entriesWithHtml: Array<{ title: string; kinds: string[] }>;
  renamedSlugs: Array<{ title: string; from: string; to: string }>;
  redirectsSuggested: number;
  fieldsLeftOut?: Array<{ title: string; fields: string[] }>;
  problems: Array<{ kind: WordPressItemKind; title: string; message: string }>;
}

export interface WordPressImport {
  id: string;
  filename: string;
  siteTitle: string;
  siteAddress: string;
  status: WordPressImportStatus;
  found: {
    posts: number;
    pages: number;
    attachments: number;
    authors: number;
    categories: number;
    tags: number;
    menus?: number;
    products?: number;
    customFields?: { post: WordPressCustomField[]; page: WordPressCustomField[] };
    ignored: Record<string, number>;
  };
  mapping: WordPressImportMapping | null;
  progress: { done: number; total: number };
  hasContentZip: boolean;
  lastError: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface MappingChoices {
  import: WordPressImport;
  collections: Array<{ handle: string; name: string }>;
  taxonomies: Array<{ handle: string; name: string }>;
  collectionFields: Record<string, Array<{ handle: string; label: string; type: string }>>;
  shopEnabled: boolean;
  suggested: WordPressImportMapping;
}

export async function listWordPressImports() {
  return (await apiRequest<{ imports: WordPressImport[] }>("/wordpress-imports")).imports;
}

export function getWordPressImport(importId: string) {
  return apiRequest<WordPressImport & { report: WordPressImportReport | null }>(
    `/wordpress-imports/${encodeURIComponent(importId)}`,
  );
}

export function getMappingChoices(importId: string) {
  return apiRequest<MappingChoices>(`/wordpress-imports/${encodeURIComponent(importId)}/mapping`);
}

export function saveMapping(importId: string, mapping: WordPressImportMapping) {
  return apiRequest<{
    mapping: WordPressImportMapping;
    fields: { posts: WordPressFieldMapping | null; pages: WordPressFieldMapping | null };
  }>(`/wordpress-imports/${encodeURIComponent(importId)}/mapping`, {
    method: "PUT",
    body: mapping,
  });
}

export function dryRunWordPressImport(importId: string) {
  return apiRequest<WordPressImportReport>(
    `/wordpress-imports/${encodeURIComponent(importId)}/dry-run`,
    { method: "POST" },
  );
}

export function startWordPressImport(importId: string) {
  return apiRequest<WordPressImport>(`/wordpress-imports/${encodeURIComponent(importId)}/start`, {
    method: "POST",
  });
}

export function deleteWordPressImport(importId: string) {
  return apiRequest<void>(`/wordpress-imports/${encodeURIComponent(importId)}`, {
    method: "DELETE",
  });
}
