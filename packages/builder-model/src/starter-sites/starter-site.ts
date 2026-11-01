import type { ComponentCatalogue } from "../components/component-catalogue.js";
import type { NodeBlueprint } from "../components/component-definition.js";
import { createEmptyPage, type PageDocument } from "../document/page-document.schema.js";
import { createNode } from "../tree/create-node.js";
import type { CreateNodeId } from "../tree/node-ids.js";

/**
 * A starter site: a whole small website to begin from, with a home page and a few others,
 * its own words and pictures, a theme and gentle animations. "Start from a template" makes
 * one page per entry here; everything can be changed afterwards like any other page.
 */

export interface StarterTheme {
  /** Hex colours, like #b4562d. */
  brandColour: string;
  accentColour: string;
  /** A font pairing id from the site's themes: system, classic, editorial, geometric or friendly. */
  fontPairing: string;
  /** square, soft or round. */
  cornerStyle: string;
}

export interface StarterPage {
  /** "home" is the home page; the others are their own addresses (/menu). */
  slug: string;
  title: string;
  /** For search results and link previews. */
  summary: string;
  sections: readonly NodeBlueprint[];
}

export interface StarterSite {
  /** Lowercase letters and dashes: "bakery". */
  id: string;
  name: string;
  /** One plain sentence for the template library. */
  description: string;
  /** Who it suits: "Cafés, bakeries and delis". */
  suitedTo: string;
  /** The illustration shown on its card in the library. */
  coverIllustration: string;
  theme: StarterTheme;
  /** Home first; the menu lists them in this order. */
  pages: readonly StarterPage[];
}

/** A starter page as a page design, with fresh ids for every element. */
export function buildStarterPage(
  page: StarterPage,
  catalogue: ComponentCatalogue,
  createId: CreateNodeId,
): PageDocument {
  const empty = createEmptyPage();
  return {
    ...empty,
    root: {
      ...empty.root,
      children: page.sections.map((section) => createNode(section, catalogue, createId)),
    },
  };
}
