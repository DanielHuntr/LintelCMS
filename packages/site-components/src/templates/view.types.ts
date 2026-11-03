import type { SiteBlock } from "../blocks/block.types.js";
import type { PaginationLinks, PostSummary } from "../posts/post.types.js";
import type { SiteImage, TermLink } from "../site.types.js";

/**
 * What a page of the site shows, one kind per layout. The site server picks the kind from
 * the address; a template draws each one.
 */

/**
 * A page laid out in the visual builder, already drawn: its HTML and stylesheet from the
 * builder's renderer, and the animations the motion runtime plays (by element id).
 */
export interface PageDesign {
  html: string;
  css: string;
  animations: ReadonlyArray<{ nodeId: string; spec: Readonly<Record<string, unknown>> }>;
  /** Font files to preload, such as the page's display font. */
  fontPreloads?: readonly string[];
  /** A small script the design needs (background videos); empty or left out for none. */
  script?: string;
  /** It has sliders, tabs, pop-ups, forms or the shop, so it loads the elements script. */
  usesBehaviours?: boolean;
  /** It has its own Header, so the site's isn't drawn above it. */
  ownHeader?: boolean;
  /** It has its own Footer (or footer section), so the site's isn't drawn below it. */
  ownFooter?: boolean;
  /** Effects from the Effects library, by element id, for the effects runtime. */
  effects?: ReadonlyArray<EffectOnPage>;
  /** A code block uses `window.lintelMotion`, so the page loads the runtime. */
  usesMotionApi?: boolean;
}

/** One effect on one element, as the builder's renderer lists it. */
export interface EffectOnPage {
  nodeId: string;
  /** The lazily loaded module that runs it: "pointer", "text"... */
  module: string;
  behaviour: string;
  params: Readonly<Record<string, number | string | boolean>>;
}

/**
 * Motion across the whole site (page transitions, cursor, intro), prepared by the server:
 * CSS for the head, markup for the start of the body, and what the runtime reads.
 */
export interface SiteEffectsHead {
  css: string;
  /** The intro's markup, or empty. */
  bodyStartHtml: string;
  /** A tiny inline script for the head, or empty. */
  headScript: string;
  /** The settings the runtime reads (see SiteEffectSettings in @lintel/motion). */
  settings: Readonly<Record<string, unknown>>;
  /** The modules the site-wide effects need. */
  modules: readonly string[];
}

/** A page from a collection like Pages: a title, an optional body and its sections. */
export interface PageView {
  kind: "page";
  title: string;
  summary: string;
  heroImage: SiteImage | null;
  /** HTML from the rich text editor; empty when the page has none. */
  body: string;
  sections: SiteBlock[];
  /** When the page was designed in the builder, its design is the whole page. */
  design?: PageDesign | null;
}

/** One blog post. */
export interface PostView {
  kind: "post";
  title: string;
  excerpt: string;
  publishedAt: string | null;
  image: SiteImage | null;
  body: string;
  categories: TermLink[];
  tags: TermLink[];
  /** The list the post belongs to, for "Back to the blog". */
  backLink: { label: string; url: string } | null;
}

/** A list of posts: the blog's index, or everything filed under a category or tag. */
export interface PostListView {
  kind: "postList";
  title: string;
  description: string;
  posts: PostSummary[];
  pagination: PaginationLinks;
}

/** The address doesn't match anything published. */
export interface NotFoundView {
  kind: "notFound";
}

/** Nothing has been published yet, so the home page has nothing to show. */
export interface EmptySiteView {
  kind: "emptySite";
}

/** A short message of its own, such as "This preview link has expired". */
export interface MessageView {
  kind: "message";
  title: string;
  text: string;
}

export type SiteView =
  PageView | PostView | PostListView | NotFoundView | EmptySiteView | MessageView;
