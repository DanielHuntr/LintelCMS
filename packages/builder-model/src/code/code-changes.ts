import type { ComponentCatalogue } from "../components/component-catalogue.js";
import type { PageDocument, PageNode } from "../document/page-document.schema.js";
import { walkNodes } from "../tree/tree-queries.js";
import { type CustomScriptRule, removeScriptsFromHtml } from "./sanitise-code.js";

/**
 * Who may change code on a page, and what happens to scripts when it is saved.
 *
 * Code is the HTML, CSS and JavaScript of code blocks (and of any component marked
 * `requiresCodePermission`). People without the `builder:code` permission can still move,
 * duplicate, hide and delete code blocks, and fill in their marked fields and images; they
 * can't write new code or change existing code. A duplicate is fine because its code is the
 * same as code already on the page.
 */

const codeProps = ["html", "css", "js"] as const;

function codeOf(node: PageNode): string {
  return JSON.stringify(codeProps.map((prop) => node.props[prop] ?? ""));
}

function listCode(
  document: PageDocument | null,
  catalogue: ComponentCatalogue,
): Map<string, string> {
  const code = new Map<string, string>();
  if (!document) return code;
  walkNodes(document.root, (node) => {
    if (catalogue.find(node.type)?.requiresCodePermission) code.set(node.id, codeOf(node));
  });
  return code;
}

/**
 * The code-holding elements whose code is new: code that wasn't anywhere on the page before.
 * Empty means the change is fine for someone without the code permission.
 */
export function findChangedCode(
  previous: PageDocument | null,
  next: PageDocument,
  catalogue: ComponentCatalogue,
): string[] {
  const before = new Set(listCode(previous, catalogue).values());
  return [...listCode(next, catalogue)]
    .filter(([, code]) => !before.has(code))
    .map(([nodeId]) => nodeId);
}

/** The page as it will be saved under the site's rule for scripts. */
export function applyScriptRule(document: PageDocument, rule: CustomScriptRule): PageDocument {
  if (rule === "allowScripts") return document;
  const clean = (node: PageNode): PageNode => {
    const children = node.children.map(clean);
    if (node.type !== "codeBlock") return { ...node, children };
    const html = typeof node.props.html === "string" ? removeScriptsFromHtml(node.props.html) : "";
    return { ...node, props: { ...node.props, html, js: "" }, children };
  };
  return { ...document, root: clean(document.root) };
}
