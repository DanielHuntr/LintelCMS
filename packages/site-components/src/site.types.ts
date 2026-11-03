import type { PageDesign } from "./templates/view.types.js";

/**
 * The plain values every component takes. Nothing here knows about Lintel's API or
 * database: the site server turns published content into these, and the page builder's
 * canvas can make them by hand. Keeping props plain is what lets both render the same
 * components.
 */

/** Where the subject of a picture is: 0 to 1 across (x) and down (y). */
export interface FocalPoint {
  x: number;
  y: number;
}

/**
 * A picture from the media library. `url` is its address on Lintel's media server, which
 * resizes and crops on request (`?w=800&h=450` crops around the focal point).
 */
export interface SiteImage {
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
  focalPoint: FocalPoint | null;
  /** Shown under the picture when its licence asks for one; left out or null for none. */
  credit?: PhotoCredit | null;
}

/**
 * A photo's credit, as the media library gives it: the parts (creator and the page it came
 * from, licence and its terms) for free photos, or just `text` for one typed by hand.
 */
export interface PhotoCredit {
  text: string;
  creator: string | null;
  sourceUrl: string | null;
  licenceName: string | null;
  licenceUrl: string | null;
}

/** A link with a visible label, such as a button. */
export interface SiteLink {
  label: string;
  url: string;
  newTab?: boolean;
}

/** One item of the main menu, with the items inside it. */
export interface MenuItem {
  label: string;
  /** Null for a heading that only opens its sub-menu. */
  url: string | null;
  newTab: boolean;
  /** "button" draws it as a button ("Book now"); left out, it is a plain link. */
  style?: "link" | "button";
  /** Whether this item is the page being shown, for `aria-current`. */
  current: boolean;
  children: MenuItem[];
}

/** One of the site's languages, for the language links in the footer. */
export interface LanguageLink {
  code: string;
  name: string;
  /** This page in that language, or that language's home page. */
  url: string;
  current: boolean;
}

/** A category or tag a post is filed under, linking to its archive page. */
export interface TermLink {
  title: string;
  url: string;
}

/**
 * What appears on every page: the header, the footer and the language links. It comes
 * from the "Site settings" globals, the main menu and Settings, Site.
 */
export interface SiteChrome {
  siteName: string;
  logo: SiteImage | null;
  homeUrl: string;
  menu: MenuItem[];
  footerText: string;
  contactEmail: string;
  socialLinks: string[];
  languages: LanguageLink[];
  /** The language of the page being shown, such as "en-GB". */
  locale: string;
  /**
   * The site's own navigation section, made in the builder and drawn for this page, in
   * place of the automatic header. Left out while the site has none.
   */
  navigationDesign?: PageDesign;
  /** The same for the footer. */
  footerDesign?: PageDesign;
  /** The site asks visitors about cookies, so the footer offers "Cookie settings". */
  cookieSettings?: boolean;
}

/**
 * Words the site itself shows (not written by editors). English by default; a site in
 * another language can pass its own.
 */
export interface SiteLabels {
  skipToContent: string;
  mainMenu: string;
  languages: string;
  previousPage: string;
  nextPage: string;
  pageOfPages: (page: number, totalPages: number) => string;
  pagination: string;
  readMore: string;
  categories: string;
  tags: string;
  noPostsYet: string;
  notFoundTitle: string;
  notFoundText: string;
  backHome: string;
  emptySiteTitle: string;
  emptySiteText: string;
  socialLinks: string;
  contact: string;
  cookieSettings: string;
  /** The button that skips the first-visit intro (see site-effects in @lintel/core). */
  skipIntro: string;
}

export const englishLabels: SiteLabels = {
  skipToContent: "Skip to content",
  mainMenu: "Main menu",
  languages: "Languages",
  previousPage: "Newer posts",
  nextPage: "Older posts",
  pageOfPages: (page, totalPages) => `Page ${page} of ${totalPages}`,
  pagination: "More posts",
  readMore: "Read more",
  categories: "Categories",
  tags: "Tags",
  noPostsYet: "Nothing has been posted here yet.",
  notFoundTitle: "We couldn’t find that page",
  notFoundText: "It may have moved, or the address may have a typo in it.",
  backHome: "Go to the home page",
  emptySiteTitle: "This website has no home page yet",
  emptySiteText:
    "In Lintel, publish the first page at the top of the page tree. It becomes the home page, at this address.",
  socialLinks: "Elsewhere",
  contact: "Contact",
  cookieSettings: "Cookie settings",
  skipIntro: "Skip intro",
};
