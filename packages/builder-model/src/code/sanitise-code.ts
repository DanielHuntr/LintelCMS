import type { HtmlElement, HtmlNode } from "../html/html-parser.js";
import { parseHtml } from "../html/html-parser.js";
import { writeHtml } from "../html/html-writer.js";

/**
 * What a site allows in code blocks, set in the site's settings:
 *
 *   - "removeScripts" (the default): the HTML is kept but anything that runs JavaScript is
 *     taken out when the page is saved: `<script>`, `on…` attributes, `javascript:` links,
 *     `<iframe srcdoc>` and the like, and the block's own JavaScript.
 *   - "allowScripts": code is saved as written, for sites whose developers need scripts.
 *
 * Either way the admin's canvas draws code blocks inside a sandboxed frame, so code can't
 * reach the admin while someone is editing.
 */
export const customScriptRules = ["removeScripts", "allowScripts"] as const;
export type CustomScriptRule = (typeof customScriptRules)[number];

const scriptElements = new Set([
  "script",
  "noscript",
  "object",
  "embed",
  "applet",
  "base",
  "meta",
  "link",
  "frame",
  "frameset",
]);
const addressAttributes = new Set([
  "href",
  "src",
  "action",
  "formaction",
  "xlink:href",
  "poster",
  "data",
  "background",
]);

export function removeScriptsFromHtml(html: string): string {
  return writeHtml(cleanNodes(parseHtml(html)));
}

function cleanNodes(nodes: readonly HtmlNode[]): HtmlNode[] {
  return nodes.flatMap((node): HtmlNode[] => {
    if (node.kind !== "element") return [node];
    if (scriptElements.has(node.tag)) return [];
    return [cleanElement(node)];
  });
}

function cleanElement(element: HtmlElement): HtmlElement {
  const attributes = element.attributes.filter(([name, value]) => {
    if (name.startsWith("on") || name === "srcdoc") return false;
    if (addressAttributes.has(name) && isScriptAddress(value)) return false;
    return !(
      name === "style" && /expression\s*\(|javascript:|url\s*\(\s*['"]?\s*javascript:/i.test(value)
    );
  });
  return { ...element, attributes, children: cleanNodes(element.children) };
}

function isScriptAddress(value: string): boolean {
  // Browsers ignore white space and control characters inside the scheme.
  const compact = Array.from(value)
    .filter((character) => character.charCodeAt(0) > 32)
    .join("")
    .toLowerCase();
  return (
    compact.startsWith("javascript:") ||
    compact.startsWith("vbscript:") ||
    compact.startsWith("data:text/html")
  );
}

/** CSS can't run scripts in today's browsers, but it can close the style element it sits in. */
export function makeCssSafeToEmbed(css: string): string {
  return css.replace(/<\/style/gi, "<\\/style");
}

/** A script's text, safe to put inside `<script>`: it can't end the element early. */
export function makeScriptSafeToEmbed(script: string): string {
  return script.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");
}
