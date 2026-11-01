import { renderPage, standardRegistry } from "@lintel/builder/render";
import { validatePageDocument } from "@lintel/builder-model";
import type { PageDesignHtml } from "@lintel/site-components";
import { pageComponentCatalogue } from "../pages/page-components.js";

/**
 * A page's visual design (its `page` field, see src/pages), drawn for the website with the
 * same renderer the builder's canvas uses, so visitors see what the editor saw. Null when
 * the entry has no design, or an empty one: the page then shows its title, body and
 * sections as usual.
 */
export function renderPageDesign(data: Record<string, unknown>): PageDesignHtml | null {
  for (const value of Object.values(data)) {
    if (!looksLikePageDesign(value)) continue;
    const checked = validatePageDocument(value, pageComponentCatalogue);
    if (!checked.ok || checked.document.root.children.length === 0) continue;
    const { html, css } = renderPage(checked.document, standardRegistry);
    return { html, css };
  }
  return null;
}

function looksLikePageDesign(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "root" in value &&
    "version" in value &&
    typeof (value as { root: unknown }).root === "object"
  );
}
