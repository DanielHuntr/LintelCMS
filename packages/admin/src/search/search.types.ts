import type { EntryStatus } from "../content/content.types.js";

/** `GET /search?q=`, as core's src/search sends it. null means "not yours to search". */
export interface SearchResults {
  query: string;
  entries: EntrySearchResult[] | null;
  assets: AssetSearchResult[] | null;
}

export interface EntrySearchResult {
  id: string;
  title: string;
  slug: string;
  status: EntryStatus;
  collection: { handle: string; name: string };
  updatedAt: string;
}

export interface AssetSearchResult {
  id: string;
  filename: string;
  alt: string;
  mimeType: string;
  thumbnailUrl: string | null;
}
