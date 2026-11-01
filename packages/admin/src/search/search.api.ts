import { apiRequest } from "../api/client.js";
import type { SearchResults } from "./search.types.js";

export function searchEverything(query: string): Promise<SearchResults> {
  const params = new URLSearchParams({ q: query, limit: "6" });
  return apiRequest<SearchResults>(`/search?${params.toString()}`);
}
