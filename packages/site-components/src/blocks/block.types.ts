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

/** One question of a form, as a website draws it. */
export interface SiteFormField {
  handle: string;
  type: string;
  label: string;
  helpText: string;
  placeholder: string;
  required: boolean;
  /** The answers to pick from, for choice, checkboxes and dropdown fields. */
  choices: string[];
}

/**
 * A form, drawn as plain HTML that works without scripts on the visitor's side apart from
 * fetching its anti-spam token. `action` is where answers are posted: Lintel's API, or the
 * small PHP companion on a website published as files.
 */
export interface SiteForm {
  handle: string;
  name: string;
  submitLabel: string;
  acceptingSubmissions: boolean;
  action: string;
  /** Answers `{ "token": "…" }`, the signed "opened at" time the answers are sent with. */
  tokenUrl: string;
  /** The small script that fetches the token. */
  scriptUrl: string;
  honeypotField: string;
  tokenField: string;
  fields: SiteFormField[];
}

export interface FormBlock {
  type: "form";
  id: string;
  heading: string;
  /** The handle of the form chosen for this section. */
  handle: string;
  /** Null when the form was deleted or forms are switched off. */
  form: SiteForm | null;
}

export type SiteBlock =
  HeroBlock | TextBlock | ImageBlock | CallToActionBlock | FaqBlock | FormBlock;

export type SiteBlockType = SiteBlock["type"];

export const siteBlockTypes: readonly SiteBlockType[] = [
  "hero",
  "text",
  "image",
  "call_to_action",
  "faq",
  "form",
];
