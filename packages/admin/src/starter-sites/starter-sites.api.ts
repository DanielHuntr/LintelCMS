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
  menuFilled: boolean;
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
