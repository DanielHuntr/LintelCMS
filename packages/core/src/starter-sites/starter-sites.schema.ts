import { z } from "zod";

export const existingPagesChoices = ["ask", "replace", "alongside"] as const;

/** `POST /starter-sites/:id/apply`: what to do besides making the pages. */
export const applyStarterSiteRequestSchema = z.object({
  /** Use the template's colours, fonts and corners for the website (needs settings:update). */
  useTheme: z.boolean({ error: "useTheme should be true or false" }).default(true),
  /** Put the pages live straight away (needs entries:publish); otherwise they are drafts. */
  publish: z.boolean({ error: "publish should be true or false" }).default(false),
  /**
   * What happens to pages the site already has. "ask" (the default) refuses with 409
   * SITE_HAS_PAGES when there are any; "replace" moves them to the recycle bin (needs
   * entries:delete); "alongside" keeps them, skips the template's home page and gives
   * pages whose address is taken the next free one ("About (2)" at "/about-2").
   */
  existingPages: z
    .enum(existingPagesChoices, {
      error: 'existingPages should be "ask", "replace" or "alongside"',
    })
    .default("ask"),
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
  /** Added alongside pages that were there: the template's home page was left out. */
  skippedHome: boolean;
  /** Replacing: how many pages went to the recycle bin (with everything under them). */
  replacedCount: number;
}

/** `GET /starter-sites/:id/existing-pages`: what applying would meet, for the admin's question. */
export interface ExistingPagesResponse {
  pageCount: number;
  hasHome: boolean;
  /** Template pages whose address a page already has. */
  clashes: { title: string; slug: string; existingTitle: string }[];
}
