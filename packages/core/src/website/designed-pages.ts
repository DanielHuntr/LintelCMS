import {
  applyScriptRule,
  type CustomScriptRule,
  findPlace,
  ownSiteChrome,
  type PageData,
  type PageDocument,
  removeNode,
  validatePageDocument,
} from "@lintel/builder-model";
import { renderPage, standardRegistry } from "@lintel/builder/render";
import type { PageDesign } from "@lintel/site-components";
import { removeScriptsFromCodeHtml } from "../fieldtypes/code-html-cleaner.js";
import { pageComponentCatalogue } from "../pages/page-components.js";

/**
 * A page designed in the visual builder, drawn for the website by the builder's own
 * renderer: the same components and the same stylesheet rules the canvas uses, so the
 * published page is the page people designed. Animated elements are marked for the motion
 * runtime, and the page lists its animations so only pages that move load it.
 *
 * Stored designs were checked when they were saved; they are checked again here, because a
 * design saved by an older version may hold something this version doesn't know. An element
 * that no longer checks out is left out, with what's inside it; one such element used to
 * hide the whole design (LINTEL-FUNC-023). The editor still names it when the page is
 * opened. A design that can't be read at all, or has nothing on it, counts as no design.
 *
 * The site's script rule is applied here too, not only when a design is saved: code saved
 * while scripts were allowed used to keep them after the site went back to removing them
 * (LINTEL-SEC-003).
 */
export function checkPageDesign(value: unknown, scriptRule: CustomScriptRule): PageDocument | null {
  if (value === null || value === undefined) {
    return null;
  }
  let checked = validatePageDocument(value, pageComponentCatalogue);
  // Each round takes out the elements named; a few rounds cover anything uncovered by that.
  for (let round = 0; !checked.ok && round < 3; round += 1) {
    if (!checked.document || checked.problems.some((problem) => !problem.nodeId)) return null;
    let root = checked.document.root;
    for (const { nodeId } of checked.problems) {
      if (nodeId && nodeId !== root.id && findPlace(root, nodeId)) root = removeNode(root, nodeId);
    }
    checked = validatePageDocument({ ...checked.document, root }, pageComponentCatalogue);
  }
  if (!checked.ok || checked.document.root.children.length === 0) {
    return null;
  }
  return applyScriptRule(checked.document, scriptRule, removeScriptsFromCodeHtml);
}

/** Draws a checked design with what its dynamic elements show (see page-data.service.ts). */
export function drawPageDesign(document: PageDocument, data: PageData = {}): PageDesign {
  const { html, css, animations, effects, usesMotionApi, fontPreloads, script, usesBehaviours } =
    renderPage(document, standardRegistry, { withMotion: true, data });
  // A page with its own Header or Footer shows it instead of the site's (LINTEL-FUNC-005).
  const own = ownSiteChrome(document.root);
  return {
    html,
    css,
    animations,
    effects,
    usesMotionApi,
    fontPreloads,
    script,
    usesBehaviours,
    ownHeader: own.header,
    ownFooter: own.footer,
  };
}

/** A design drawn without data: what a page's view starts with before its lists are loaded. */
export function readPageDesign(value: unknown, scriptRule: CustomScriptRule): PageDesign | null {
  const document = checkPageDesign(value, scriptRule);
  return document ? drawPageDesign(document) : null;
}
