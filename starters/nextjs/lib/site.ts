/** The site's name, shown in the header and browser tab. Set SITE_NAME in .env.local. */
export const siteName = process.env.SITE_NAME ?? "My Lintel site";

/** How many posts the blog index shows on each page. */
export const POSTS_PER_PAGE = 10;

/** The page shown as the home page, if Pages has one with this slug. */
export const HOME_PAGE_SLUG = "home";
