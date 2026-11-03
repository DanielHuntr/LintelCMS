import type { SiteEffectSettings } from "@lintel/motion/effects";
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
  /** A family from the included fonts for headings ("Archivo"); left out follows the pairing. */
  headingFont?: string;
  /** The same for body text. */
  bodyFont?: string;
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
  /**
   * Motion across the whole site that comes with the look: smooth scrolling, the cursor, the
   * page transition and the first-visit intro. Each part changes only what it names; applied
   * with the theme.
   */
  siteMotion?: StarterSiteMotion;
  /** Home first; the menu lists them in this order. */
  pages: readonly StarterPage[];
}

/** Some of the site's motion settings, each part only the values it changes. */
export type StarterSiteMotion = {
  [Part in keyof SiteEffectSettings]?: Partial<SiteEffectSettings[Part]>;
};

/** A starter page as a page design, with fresh ids for every element. */
/**
 * What a site has switched on, for the parts of a template that need a plugin: a section
 * with a form needs Forms, and `forms` says which form fills it (the template's own form
 * handle, such as "contact", to the handle of the form made for it).
 */
export interface StarterPageOptions {
  enabledPlugins?: readonly string[];
  forms?: Readonly<Record<string, string>>;
}

export function buildStarterPage(
  page: StarterPage,
  catalogue: ComponentCatalogue,
  createId: CreateNodeId,
  options: StarterPageOptions = {},
): PageDocument {
  const empty = createEmptyPage();
  const enabled = options.enabledPlugins ?? [];
  const usable = (blueprint: NodeBlueprint): boolean => {
    const plugin = catalogue.find(blueprint.type)?.requiresPlugin;
    return (!plugin || enabled.includes(plugin)) && (blueprint.children ?? []).every(usable);
  };
  return {
    ...empty,
    root: {
      ...empty.root,
      children: page.sections
        .filter(usable)
        .map((section) =>
          createNode(withFormHandles(section, options.forms ?? {}), catalogue, createId),
        ),
    },
  };
}

/** The forms a template's pages show, by the handle the template gives them. */
export function formsUsedBy(page: StarterPage): string[] {
  const handles = new Set<string>();
  const visit = (blueprint: NodeBlueprint) => {
    if (blueprint.type === "formEmbed" && typeof blueprint.props?.form === "string") {
      handles.add(blueprint.props.form);
    }
    blueprint.children?.forEach(visit);
  };
  page.sections.forEach(visit);
  return [...handles];
}

function withFormHandles(
  blueprint: NodeBlueprint,
  forms: Readonly<Record<string, string>>,
): NodeBlueprint {
  const form = blueprint.type === "formEmbed" ? blueprint.props?.form : undefined;
  return {
    ...blueprint,
    ...(typeof form === "string" && forms[form]
      ? { props: { ...blueprint.props, form: forms[form] } }
      : {}),
    ...(blueprint.children
      ? { children: blueprint.children.map((child) => withFormHandles(child, forms)) }
      : {}),
  };
}
