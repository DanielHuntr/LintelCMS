import { z } from "zod";

/** `POST /starter-sites/:id/apply`: what to do besides making the pages. */
export const applyStarterSiteRequestSchema = z.object({
  /** Use the template's colours, fonts and corners for the website (needs settings:update). */
  useTheme: z.boolean({ error: "useTheme should be true or false" }).default(true),
  /** Put the pages live straight away (needs entries:publish); otherwise they are drafts. */
  publish: z.boolean({ error: "publish should be true or false" }).default(false),
});

/** `POST /starter-sites/menu`: link pages from a template in a main menu that has links. */
export const addPagesToMenuRequestSchema = z.object({
  entryIds: z
    .array(z.uuid({ error: "Each page should be an entry id" }))
    .min(1, { error: "Choose at least one page" })
    .max(50),
});

export const starterSiteParamsSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/, { error: "That isn't one of the templates" }),
});

export type ApplyStarterSiteRequest = z.output<typeof applyStarterSiteRequestSchema>;
export type AddPagesToMenuRequest = z.output<typeof addPagesToMenuRequestSchema>;

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
  /** The main menu was empty, so a link to every page was put in it. */
  menuFilled: boolean;
  /**
   * The main menu already had links, so it was left alone; the admin offers to add the
   * pages to it (`POST /starter-sites/menu`).
   */
  menuHasLinks: boolean;
}
