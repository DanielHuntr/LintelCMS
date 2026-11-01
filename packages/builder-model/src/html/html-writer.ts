import { type HtmlElement, type HtmlNode, parseHtml, voidElements } from "./html-parser.js";

/** Writing parsed HTML back out: escaped, and optionally indented for the code view. */

export function escapeText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const rawText = new Set(["script", "style"]);

function openingTag(element: HtmlElement): string {
  const attributes = element.attributes
    .map(([name, value]) =>
      value === "" && isBooleanAttribute(name)
        ? ` ${name}`
        : ` ${name}="${escapeAttribute(value)}"`,
    )
    .join("");
  return `<${element.tag}${attributes}>`;
}

function isBooleanAttribute(name: string): boolean {
  return [
    "hidden",
    "disabled",
    "checked",
    "selected",
    "open",
    "required",
    "autoplay",
    "muted",
    "loop",
    "controls",
    "playsinline",
    "defer",
    "async",
  ].includes(name);
}

/** The nodes as compact HTML, exactly as parsed apart from normalised quoting. */
export function writeHtml(nodes: readonly HtmlNode[]): string {
  return nodes.map(writeNode).join("");
}

function writeNode(node: HtmlNode): string {
  if (node.kind === "text") return escapeText(node.text);
  if (node.kind === "comment") return `<!--${node.text}-->`;
  if (voidElements.has(node.tag)) return openingTag(node);
  const inner = rawText.has(node.tag)
    ? node.children.map((child) => (child.kind === "text" ? child.text : "")).join("")
    : writeHtml(node.children);
  return `${openingTag(node)}${inner}</${node.tag}>`;
}

const inlineElements = new Set([
  "a",
  "abbr",
  "b",
  "br",
  "cite",
  "code",
  "em",
  "i",
  "img",
  "kbd",
  "mark",
  "q",
  "s",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "time",
  "u",
]);

/**
 * Indents HTML two spaces per level, one block element per line. Elements holding only text
 * and inline elements (a heading, a paragraph with a link) stay on one line, so the code view
 * reads like hand-written markup.
 */
export function formatHtml(html: string): string {
  return formatNodes(parseHtml(html), 0).join("\n");
}

function formatNodes(nodes: readonly HtmlNode[], depth: number): string[] {
  const indent = "  ".repeat(depth);
  const lines: string[] = [];
  for (const node of nodes) {
    if (node.kind === "text") {
      const text = node.text.replace(/\s+/g, " ").trim();
      if (text !== "") lines.push(`${indent}${escapeText(text)}`);
      continue;
    }
    if (node.kind === "comment" || rawText.has(node.tag)) {
      lines.push(`${indent}${writeNode(node)}`);
      continue;
    }
    if (voidElements.has(node.tag) || isInlineOnly(node)) {
      lines.push(`${indent}${writeNode(node).replace(/\s*\n\s*/g, " ")}`);
      continue;
    }
    lines.push(
      `${indent}${openingTag(node)}`,
      ...formatNodes(node.children, depth + 1),
      `${indent}</${node.tag}>`,
    );
  }
  return lines;
}

function isInlineOnly(element: HtmlElement): boolean {
  return element.children.every(
    (child) =>
      child.kind === "text" ||
      (child.kind === "element" && inlineElements.has(child.tag) && isInlineOnly(child)),
  );
}
