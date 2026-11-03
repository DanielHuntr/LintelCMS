import { apiRequest } from "../api/client.js";

/** "Start from a template" (see packages/core/src/starter-sites). */

/** What happens to pages the site already has: never decided for the person. */
export type ExistingPagesChoice = "replace" | "alongside";

export interface ApplyStarterSiteOptions {
  useTheme: boolean;
  publish: boolean;
  /** Needed when the site has pages; without it the API answers 409 SITE_HAS_PAGES. */
  existingPages?: ExistingPagesChoice;
}

/** What a template would meet on the site. */
export interface ExistingPages {
  pageCount: number;
  hasHome: boolean;
  clashes: { title: string; slug: string; existingTitle: string }[];
}

export function getExistingPages(starterSiteId: string): Promise<ExistingPages> {
  return apiRequest(`/starter-sites/${encodeURIComponent(starterSiteId)}/existing-pages`);
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
  /** Added alongside: the site kept its home page, and the template's was left out. */
  skippedHome: boolean;
  /** Replaced: how many pages went to the recycle bin. */
  replacedCount: number;
  /** The template's menu and footer took the place of the site's, which were kept. */
  previousSectionsKept: boolean;
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
