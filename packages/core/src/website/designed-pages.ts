import { validatePageDocument } from "@lintel/builder-model";
import { renderPage, standardRegistry } from "@lintel/builder/render";
import type { PageDesign } from "@lintel/site-components";
import { pageComponentCatalogue } from "../pages/page-components.js";

/**
 * A page designed in the visual builder, drawn for the website by the builder's own
 * renderer: the same components and the same stylesheet rules the canvas uses, so the
 * published page is the page people designed. Animated elements are marked for the motion
 * runtime, and the page lists its animations so only pages that move load it.
 *
 * Stored designs were checked when they were saved; they are checked again here, because a
 * design saved by an older version may hold something this version doesn't know. A design
 * that can't be read, or has nothing on it, counts as no design.
 */
export function readPageDesign(value: unknown): PageDesign | null {
  if (value === null || value === undefined) {
    return null;
  }
  const checked = validatePageDocument(value, pageComponentCatalogue);
  if (!checked.ok || checked.document.root.children.length === 0) {
    return null;
  }
  const { html, css, animations } = renderPage(checked.document, standardRegistry, {
    withMotion: true,
  });
  return { html, css, animations };
}
