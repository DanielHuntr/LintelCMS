import { z } from "zod";
import type { ComponentCatalogue } from "../components/component-catalogue.js";
import { ownSiteChrome } from "../components/site-navigation-components.js";
import {
  createEmptyPage,
  type PageDocument,
  type PageNode,
  pageNodeSchema,
} from "../document/page-document.schema.js";
import { findNode, walkNodes } from "../tree/tree-queries.js";
import { removeNode } from "../tree/tree-changes.js";

/**
 * The site's navigation and footer: two sections stored once for the whole site and shown
 * on every page, in the same place. Editing one on any page edits it everywhere.
 *
 * Pages don't keep a copy. The builder puts them into the page it opens (`withSiteSections`)
 * under fixed ids, so they can be selected, styled and undone like anything else, and takes
 * them out again before the page is saved (`splitSiteSections`). What a page keeps is only
 * whether it hides them (`hideSiteNavigation`, `hideSiteFooter` on the page itself).
 *
 * A site without a navigation section keeps the website's automatic header (and the same
 * for the footer), so sites made before these existed look the same until they add one.
 */

export const siteSectionSlots = ["navigation", "footer"] as const;
export type SiteSectionSlot = (typeof siteSectionSlots)[number];

/** The ids the sections have inside a page while it is being edited. */
export const siteSectionNodeIds: Readonly<Record<SiteSectionSlot, string>> = {
  navigation: "site-navigation",
  footer: "site-footer",
};

/** The page's own switches for hiding them, on the page node's props. */
export const siteSectionHideProps = {
  navigation: "hideSiteNavigation",
  footer: "hideSiteFooter",
} as const satisfies Readonly<Record<SiteSectionSlot, string>>;

/** The element each is drawn as, so it is the page's banner or content information. */
export const siteSectionElements: Readonly<Record<SiteSectionSlot, "header" | "footer">> = {
  navigation: "header",
  footer: "footer",
};

export interface SiteSections {
  navigation: PageNode | null;
  footer: PageNode | null;
}

export const noSiteSections: SiteSections = { navigation: null, footer: null };

export const siteSectionsSchema = z.object({
  navigation: pageNodeSchema.nullable().default(null),
  footer: pageNodeSchema.nullable().default(null),
});

/** A change to some of them: the slots named are replaced (null takes one away), the rest stay. */
export const siteSectionsChangeSchema = z.object({
  navigation: pageNodeSchema.nullable().optional(),
  footer: pageNodeSchema.nullable().optional(),
});
export type SiteSectionsChange = Partial<SiteSections>;

/** Which of the site's sections a node is, by its id; null for every other node. */
export function siteSectionSlotOf(nodeId: string): SiteSectionSlot | null {
  return siteSectionSlots.find((slot) => siteSectionNodeIds[slot] === nodeId) ?? null;
}

/** Whether a page has switched one of the site's sections off. */
export function isHiddenOnPage(page: PageNode, slot: SiteSectionSlot): boolean {
  return page.props[siteSectionHideProps[slot]] === true;
}

/** The page node with its switch for one of the site's sections set (or left out when off). */
export function withHiddenOnPage(page: PageNode, slot: SiteSectionSlot, hidden: boolean): PageNode {
  const key = siteSectionHideProps[slot];
  if (isHiddenOnPage(page, slot) === hidden) return page;
  const props = { ...page.props };
  if (hidden) props[key] = true;
  else delete props[key];
  return { ...page, props };
}

/**
 * A node with a new id, and everything inside it that pointed at the old one (owner states
 * such as "hover@n3", animations that follow it) pointing at the new one.
 */
export function renameNodeId(node: PageNode, from: string, to: string): PageNode {
  if (from === to) return node;
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const json = JSON.stringify(node).replace(new RegExp(`(?<=["@])${escaped}(?=")`, "g"), to);
  return JSON.parse(json) as PageNode;
}

/** A section made into one of the site's: its fixed id and the right landmark element. */
export function asSiteSection(node: PageNode, slot: SiteSectionSlot): PageNode {
  const renamed = renameNodeId(node, node.id, siteSectionNodeIds[slot]);
  return {
    ...renamed,
    hidden: false,
    locked: false,
    props:
      renamed.type === "section"
        ? { ...renamed.props, element: siteSectionElements[slot] }
        : renamed.props,
  };
}

/**
 * The page with the site's sections in it, as the builder edits it: the navigation first,
 * the footer last. One the page hides, or that would double the page's own header or footer,
 * is put in hidden, so it can be shown again from Layers or the page's settings.
 */
export function withSiteSections(document: PageDocument, sections: SiteSections): PageDocument {
  let root = document.root;
  for (const slot of siteSectionSlots) {
    if (findNode(root, siteSectionNodeIds[slot])) root = removeNode(root, siteSectionNodeIds[slot]);
  }
  const own = ownSiteChrome(root);
  const placed = (slot: SiteSectionSlot): PageNode[] => {
    const section = sections[slot];
    if (!section) return [];
    const ownsOne = slot === "navigation" ? own.header : own.footer;
    return [
      {
        ...asSiteSection(section, slot),
        hidden: isHiddenOnPage(root, slot) || ownsOne,
      },
    ];
  };
  return {
    ...document,
    root: { ...root, children: [...placed("navigation"), ...root.children, ...placed("footer")] },
  };
}

/**
 * The page as it is saved, without the site's sections, and the sections as they are now.
 * A section the page has hidden marks the page as hiding it; one that isn't in the page at
 * all (taken away from the site) comes back as null.
 */
export function splitSiteSections(document: PageDocument): {
  document: PageDocument;
  sections: SiteSections;
} {
  let root = document.root;
  const sections: SiteSections = { navigation: null, footer: null };
  for (const slot of siteSectionSlots) {
    const node = findNode(root, siteSectionNodeIds[slot]);
    if (!node) continue;
    sections[slot] = { ...node, hidden: false, locked: false };
    root = withHiddenOnPage(removeNode(root, node.id), slot, node.hidden);
  }
  return { document: root === document.root ? document : { ...document, root }, sections };
}

/** Whether the page in the builder has one of the site's sections in it (shown or hidden). */
export function hasSiteSection(root: PageNode, slot: SiteSectionSlot): boolean {
  return root.children.some((child) => child.id === siteSectionNodeIds[slot]);
}

/** Whether the page has anything of its own, leaving the site's sections out. */
export function hasOwnContent(root: PageNode): boolean {
  return root.children.some((child) => siteSectionSlotOf(child.id) === null);
}

/**
 * The site's sections as a page of their own, for the website to draw them around pages
 * that have no design (and apart from the ones that do). Every element's layer name starts
 * with "Site", so their class names never meet a page's ("site-navigation", "site-link").
 */
export function siteSectionsPage(
  sections: SiteSections,
  catalogue: ComponentCatalogue,
): PageDocument {
  const page = createEmptyPage();
  const named = (node: PageNode): PageNode => ({
    ...node,
    name: `Site ${node.name || catalogue.find(node.type)?.label || node.type}`.slice(0, 80),
    children: node.children.map(named),
  });
  const children = siteSectionSlots.flatMap((slot) => {
    const section = sections[slot];
    return section ? [named(asSiteSection(section, slot))] : [];
  });
  return { ...page, root: { ...page.root, children } };
}

/** Element types that make a row of links a menu. */
const menuTypes: ReadonlySet<string> = new Set(["navigation", "mobileMenu", "siteHeader"]);

/**
 * The first section of a page when it looks like the page's own navigation (it holds a menu,
 * or a row of three or more links) but isn't marked as one: the builder offers to mark it,
 * so the site's navigation doesn't show above it as well. Null when there is none, or the
 * page already has its own.
 */
export function unmarkedOwnNavigation(root: PageNode): PageNode | null {
  if (ownSiteChrome(root).header) return null;
  const first = root.children.find(
    (child) => !child.hidden && siteSectionSlotOf(child.id) === null,
  );
  if (!first || first.type !== "section") return null;
  let looksLikeMenu = false;
  walkNodes(first, (node) => {
    if (menuTypes.has(node.type)) looksLikeMenu = true;
    if (node.children.filter((child) => child.type === "link").length >= 3) looksLikeMenu = true;
  });
  return looksLikeMenu ? first : null;
}
