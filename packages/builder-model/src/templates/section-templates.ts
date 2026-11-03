import type { NodeBlueprint } from "../components/component-definition.js";
import { closingSections } from "./closing-sections.js";
import { extraFooterSections, navigationSections } from "./navigation-sections.js";
import { openingSections } from "./opening-sections.js";

/**
 * The section library: ready-made sections for the Insert panel, grouped by what they are
 * for. Each is made of ordinary elements, so everything in it can be changed like anything
 * else on the page, and each comes with gentle animations that anyone can change or remove
 * in the Animate panel.
 *
 * Groups and names describe the job a section does, never a kind of business: a bakery's
 * opening hours are "Opening times" under Contact and booking. `keywords` keep them findable
 * by the words people might search for ("bakery", "appointment").
 *
 * The same section builders (src/sections) make the starter sites, with their own words.
 */

export const sectionCategories = [
  "navigation",
  "intro",
  "features",
  "about",
  "pictures",
  "proof",
  "pricing",
  "questions",
  "contact",
  "shop",
  "footer",
] as const;
export type SectionCategory = (typeof sectionCategories)[number];

export interface SectionTemplate {
  id: string;
  label: string;
  /** One plain sentence: what the section is good for. */
  description: string;
  category: SectionCategory;
  /** Other words people might search for, such as the kinds of business that use it. */
  keywords?: readonly string[];
  blueprint: NodeBlueprint;
}

export const sectionTemplates: readonly SectionTemplate[] = [
  ...navigationSections,
  ...openingSections,
  ...closingSections,
  ...extraFooterSections,
];

/**
 * The groups whose sections are the site's own navigation and footer: added from Insert,
 * they go on every page (see site-sections/).
 */
export const siteSectionCategories = {
  navigation: "navigation",
  footer: "footer",
} as const satisfies Record<string, SectionCategory>;

export function findSectionTemplate(templateId: string): SectionTemplate | undefined {
  return sectionTemplates.find((template) => template.id === templateId);
}
