import { z } from "zod";

/** `POST /starter-sites/:id/apply`: what to do besides making the pages. */
export const applyStarterSiteRequestSchema = z.object({
  /** Use the template's colours, fonts and corners for the website (needs settings:update). */
  useTheme: z.boolean({ error: "useTheme should be true or false" }).default(true),
  /** Put the pages live straight away (needs entries:publish); otherwise they are drafts. */
  publish: z.boolean({ error: "publish should be true or false" }).default(false),
});

export const starterSiteParamsSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/, { error: "That isn't one of the templates" }),
});

export type ApplyStarterSiteRequest = z.output<typeof applyStarterSiteRequestSchema>;

export interface AppliedStarterPage {
  entryId: string;
  title: string;
  slug: string;
  /** The template's own slug, when the page had to take another because it was in use. */
  wantedSlug: string;
  published: boolean;
}

export interface AppliedStarterSiteResponse {
  starterSiteId: string;
  pages: AppliedStarterPage[];
  themeApplied: boolean;
  menuFilled: boolean;
}
