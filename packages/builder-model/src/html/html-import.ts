import type { ComponentCatalogue } from "../components/component-catalogue.js";
import { isSafeImageAddress, isSafeLinkAddress } from "../components/component-props.js";
import type { NodeBlueprint } from "../components/component-definition.js";
import type { NodeStyles, PageNode } from "../document/page-document.schema.js";
import type { CreateNodeId } from "../tree/node-ids.js";
import { createNode } from "../tree/create-node.js";
import {
  attributeOf,
  collapseWhiteSpace,
  type HtmlElement,
  type HtmlNode,
  parseHtml,
  textContent,
} from "./html-parser.js";
import { writeHtml } from "./html-writer.js";

/**
 * Turns HTML (pasted onto the canvas, or edited in the code view) into builder elements.
 * Known tags become the matching element, so they stay visually editable:
 *
 *   h1–h6 → Heading      p → Paragraph        a → Link, or Button if its class says so
 *   img, figure → Picture ul, ol → List       nav → Menu        blockquote → Quote
 *   hr → Divider          section, header, footer, aside, article → Section (or Box inside one)
 *   div, main → Box
 *
 * Anything else (tables, forms, video, SVG, paragraphs with links inside...) becomes a code
 * block holding that HTML, for people allowed to add code; for everyone else it is left out
 * and counted in `skipped`, so the editor can say so. Scripts and styles are always left out.
 */

export interface HtmlImportOptions {
  catalogue: ComponentCatalogue;
  createId: CreateNodeId;
  /** Whether what can't be mapped may become code blocks. */
  allowCode: boolean;
  /**
   * The styles and layer names of the page's own classes, so HTML copied from the code view
   * (`class="hero-heading"`) comes back looking as it did.
   */
  stylesByClass?: ReadonlyMap<string, { name: string; styles: NodeStyles }>;
}

export interface HtmlImportResult {
  nodes: PageNode[];
  /** How many pieces became code blocks. */
  codeBlocks: number;
  /** How many pieces were left out. */
  skipped: number;
}

const inlineFormatting = new Set([
  "b",
  "strong",
  "i",
  "em",
  "span",
  "small",
  "mark",
  "u",
  "s",
  "sub",
  "sup",
  "br",
  "abbr",
  "time",
  "code",
]);
const sectionTags = new Set(["section", "header", "footer", "aside", "article"]);
const boxTags = new Set(["div", "main", ...sectionTags]);

export function importHtml(html: string, options: HtmlImportOptions): HtmlImportResult {
  const result: HtmlImportResult = { nodes: [], codeBlocks: 0, skipped: 0 };
  const importer = new HtmlImporter(options, result);
  const blueprints = importer.mapNodes(parseHtml(html), 0);
  result.nodes = blueprints.map((blueprint) => importer.build(blueprint));
  return result;
}

interface ImportedBlueprint extends NodeBlueprint {
  className?: string;
  children?: ImportedBlueprint[];
}

class HtmlImporter {
  constructor(
    private readonly options: HtmlImportOptions,
    private readonly result: HtmlImportResult,
  ) {}

  mapNodes(nodes: readonly HtmlNode[], depth: number): ImportedBlueprint[] {
    return nodes.flatMap((node) => this.mapNode(node, depth));
  }

  build(blueprint: ImportedBlueprint): PageNode {
    const kept = blueprint.className
      ? this.options.stylesByClass?.get(blueprint.className)
      : undefined;
    const node = createNode(
      { ...blueprint, children: [] },
      this.options.catalogue,
      this.options.createId,
    );
    return {
      ...node,
      name: kept?.name ?? node.name,
      styles: kept ? kept.styles : node.styles,
      children: (blueprint.children ?? []).map((child) => this.build(child)),
    };
  }

  private mapNode(node: HtmlNode, depth: number): ImportedBlueprint[] {
    if (node.kind === "comment") return [];
    if (node.kind === "text") {
      const text = collapseWhiteSpace(node.text);
      return text === "" ? [] : [{ type: "text", props: { text } }];
    }
    const mapped = this.mapElement(node, depth);
    if (mapped === "skip") return [];
    if (mapped) return [{ ...mapped, className: firstClass(node) }];
    return this.unmappable(node);
  }

  /** The builder element for an HTML element, "skip" to leave it out, or null if none fits. */
  private mapElement(element: HtmlElement, depth: number): ImportedBlueprint | "skip" | null {
    const { tag } = element;
    if (
      tag === "script" ||
      tag === "style" ||
      tag === "template" ||
      tag === "head" ||
      tag === "meta" ||
      tag === "link"
    ) {
      this.result.skipped += 1;
      return "skip";
    }
    if (tag === "html" || tag === "body") {
      return {
        type: "box",
        props: { element: "div" },
        children: this.mapNodes(element.children, depth),
      };
    }
    if (tag === "br") return "skip";
    const heading = /^h([1-6])$/.exec(tag);
    if (heading) {
      return hasOnlyText(element)
        ? { type: "heading", props: { text: readText(element), level: Number(heading[1]) } }
        : null;
    }
    if (tag === "p")
      return hasOnlyText(element) ? { type: "text", props: { text: readText(element) } } : null;
    if (tag === "a") return this.mapLink(element);
    if (tag === "img") return mapImage(element, "");
    if (tag === "figure") return mapFigure(element);
    if (tag === "ul" || tag === "ol") return mapList(element);
    if (tag === "nav") return mapNavigation(element);
    if (tag === "blockquote") return mapQuote(element);
    if (tag === "hr") return { type: "divider" };
    if (boxTags.has(tag)) {
      const children = this.mapNodes(element.children, depth + 1);
      if (sectionTags.has(tag) && depth === 0) {
        const anchor = attributeOf(element, "id") ?? "";
        return {
          type: "section",
          props: { element: tag, anchor: /^[A-Za-z][\w-]{0,63}$/.test(anchor) ? anchor : "" },
          children,
        };
      }
      return { type: "box", props: { element: tag === "main" ? "div" : tag }, children };
    }
    return null;
  }

  private mapLink(element: HtmlElement): ImportedBlueprint | null {
    if (!hasOnlyText(element)) return null;
    const href = attributeOf(element, "href") ?? "";
    const looksLikeButton =
      /\b(btn|button)\b/i.test(attributeOf(element, "class") ?? "") ||
      attributeOf(element, "role") === "button";
    return {
      type: looksLikeButton ? "button" : "link",
      props: {
        label: readText(element),
        href: isSafeLinkAddress(href) ? href : "",
        openInNewTab: attributeOf(element, "target") === "_blank",
      },
    };
  }

  private unmappable(element: HtmlElement): ImportedBlueprint[] {
    if (!this.options.allowCode) {
      this.result.skipped += 1;
      return [];
    }
    this.result.codeBlocks += 1;
    return [
      {
        type: "codeBlock",
        props: { html: writeHtml([element]), css: "", js: "", fields: {}, images: {} },
      },
    ];
  }
}

function firstClass(element: HtmlElement): string | undefined {
  return (attributeOf(element, "class") ?? "").trim().split(/\s+/)[0] || undefined;
}

function hasOnlyText(element: HtmlElement): boolean {
  return element.children.every(
    (child) => child.kind !== "element" || (inlineFormatting.has(child.tag) && hasOnlyText(child)),
  );
}

function readText(element: HtmlNode): string {
  return collapseWhiteSpace(textContent(element));
}

function elementChildren(element: HtmlElement, tag?: string): HtmlElement[] {
  return element.children.filter(
    (child): child is HtmlElement => child.kind === "element" && (!tag || child.tag === tag),
  );
}

function mapImage(element: HtmlElement, caption: string): ImportedBlueprint | null {
  const src = attributeOf(element, "src") ?? "";
  if (!isSafeImageAddress(src)) return null;
  return {
    type: "image",
    props: { src, alt: attributeOf(element, "alt") ?? "", assetId: null, caption },
  };
}

function mapFigure(element: HtmlElement): ImportedBlueprint | null {
  const images = elementChildren(element, "img");
  const captions = elementChildren(element, "figcaption");
  if (images.length !== 1 || elementChildren(element).length !== images.length + captions.length)
    return null;
  return mapImage(images[0] as HtmlElement, captions[0] ? readText(captions[0]) : "");
}

function mapList(element: HtmlElement): ImportedBlueprint | null {
  const items = elementChildren(element);
  if (!items.every((item) => item.tag === "li" && hasOnlyText(item))) return null;
  return { type: "list", props: { items: items.map(readText), ordered: element.tag === "ol" } };
}

function mapNavigation(element: HtmlElement): ImportedBlueprint | null {
  const links: HtmlElement[] = [];
  const collect = (node: HtmlElement) => {
    for (const child of elementChildren(node)) {
      if (child.tag === "a") links.push(child);
      else collect(child);
    }
  };
  collect(element);
  if (links.length === 0) return null;
  return {
    type: "navigation",
    props: {
      label: attributeOf(element, "aria-label") ?? "Main",
      links: links.map((link) => {
        const href = attributeOf(link, "href") ?? "";
        return { label: readText(link), href: isSafeLinkAddress(href) ? href : "" };
      }),
    },
  };
}

function mapQuote(element: HtmlElement): ImportedBlueprint | null {
  const citations = [...elementChildren(element, "cite"), ...elementChildren(element, "footer")];
  const quoted = element.children.filter((child) => !citations.includes(child as HtmlElement));
  const text = collapseWhiteSpace(quoted.map(textContent).join("\n"));
  return {
    type: "quote",
    props: { text, citation: citations[0] ? readText(citations[0]).replace(/^[—–-]\s*/, "") : "" },
  };
}
