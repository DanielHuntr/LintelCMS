import { type PageDocument, type PageNode, validatePageDocument } from "@lintel/builder-model";
import { pageComponentCatalogue } from "../pages/page-components.js";
import type { ExperimentScope } from "./experiments.schema.js";

/**
 * Versions as page designs. A whole-page version is a page design of its own. A section
 * version is kept as a page design holding just that section, with the same id as the
 * original's section, so it can be put in the page's place whatever else changes on the page
 * meanwhile. Pure: no database.
 */

/** A stored design, checked and brought up to date; null when it can't be read. */
export function readDesign(value: unknown): PageDocument | null {
  if (value === null || value === undefined) return null;
  const checked = validatePageDocument(value, pageComponentCatalogue);
  return checked.ok ? checked.document : null;
}

/** The section at the top level of a page with this id, if there is one. */
export function findTopSection(document: PageDocument, sectionId: string): PageNode | undefined {
  return document.root.children.find((child) => child.id === sectionId);
}

/** A page design holding only one of the page's sections. */
export function sectionOnly(document: PageDocument, section: PageNode): PageDocument {
  return { ...document, root: { ...document.root, children: [section] } };
}

/**
 * The page with a section version in its section's place. Undefined when the page no longer
 * has that section, or the version has lost it.
 */
export function withSectionVersion(
  page: PageDocument,
  sectionId: string,
  version: PageDocument,
): PageDocument | undefined {
  const replacement = findTopSection(version, sectionId);
  if (!replacement || !findTopSection(page, sectionId)) return undefined;
  return {
    ...page,
    root: {
      ...page.root,
      children: page.root.children.map((child) => (child.id === sectionId ? replacement : child)),
    },
  };
}

/** What a version looks like as a whole page, given the page as it is now. */
export function versionAsPage(
  test: { scope: ExperimentScope; sectionId: string | null },
  page: PageDocument,
  version: PageDocument,
): PageDocument | undefined {
  if (test.scope === "page") return version;
  return test.sectionId ? withSectionVersion(page, test.sectionId, version) : undefined;
}
