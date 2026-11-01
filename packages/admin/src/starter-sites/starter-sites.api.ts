import { apiRequest } from "../api/client.js";

/** "Start from a template" (see packages/core/src/starter-sites). */

export interface ApplyStarterSiteOptions {
  useTheme: boolean;
  publish: boolean;
}

export interface AppliedStarterPage {
  entryId: string;
  title: string;
  slug: string;
  wantedSlug: string;
  published: boolean;
}

export interface AppliedStarterSite {
  starterSiteId: string;
  pages: AppliedStarterPage[];
  themeApplied: boolean;
  /** The main menu was empty, so every page got a link in it. */
  menuFilled: boolean;
  /** The main menu had links already, so it was left alone (see addPagesToMainMenu). */
  menuHasLinks: boolean;
}

/** Links the pages at the end of the main menu, for when it already had links. */
export function addPagesToMainMenu(entryIds: readonly string[]) {
  return apiRequest<{ added: number }>("/starter-sites/menu", {
    method: "POST",
    body: { entryIds },
  });
}

export function applyStarterSite(starterSiteId: string, options: ApplyStarterSiteOptions) {
  return apiRequest<AppliedStarterSite>(
    `/starter-sites/${encodeURIComponent(starterSiteId)}/apply`,
    {
      method: "POST",
      body: options,
    },
  );
}
