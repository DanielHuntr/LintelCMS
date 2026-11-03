import type { SiteImage, SiteLink } from "../site.types.js";

/**
 * The page sections editors build pages from, as plain values. Each `type` matches a block
 * type handle in the Pages content type (see packages/core/src/collections), and each has
 * one component in this folder. Rich text arrives as finished, safe HTML from Lintel.
 */

export interface HeroBlock {
  type: "hero";
  id: string;
  heading: string;
  subheading: string;
  image: SiteImage | null;
  button: SiteLink | null;
}

export interface TextBlock {
  type: "text";
  id: string;
  heading: string;
  /** HTML from the rich text editor. */
  body: string;
}

export interface ImageBlock {
  type: "image";
  id: string;
  image: SiteImage | null;
  caption: string;
}

export interface CallToActionBlock {
  type: "call_to_action";
  id: string;
  heading: string;
  text: string;
  button: SiteLink | null;
}

export interface FaqBlock {
  type: "faq";
  id: string;
  question: string;
  /** HTML from the rich text editor. */
  answer: string;
}

/**
 * One of the site's own blocks (made in the builder or in code), already drawn by the
 * builder's renderer on the server, with the stylesheet its design needs.
 */
export interface DesignedBlock {
  type: "design";
  id: string;
  html: string;
  css: string;
}

export type SiteBlock =
  HeroBlock | TextBlock | ImageBlock | CallToActionBlock | FaqBlock | DesignedBlock;

export type SiteBlockType = Exclude<SiteBlock, DesignedBlock>["type"];

export const siteBlockTypes: readonly SiteBlockType[] = [
  "hero",
  "text",
  "image",
  "call_to_action",
  "faq",
];
