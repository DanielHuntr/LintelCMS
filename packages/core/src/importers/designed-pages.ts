import {
  attributeOf,
  createEmptyPage,
  type HtmlElement,
  type HtmlNode,
  maxCodeLength,
  type PageDocument,
  type PageNode,
  parseHtml,
  removeScriptsFromHtml,
  textContent,
  writeHtml,
} from "@lintel/builder-model";

/**
 * A page designed in Webflow or Framer, brought in as best it can be: its HTML and CSS as
 * code blocks on a designed page, one block per part of the page (header, each section,
 * footer), so it looks as it did and can be rearranged.
 *
 * So that people who don't write code can still change it, every piece of text (headings,
 * paragraphs, buttons, list items) is marked as an editable field and every picture as a
 * choosable picture: they show up in the builder's Content panel without touching the
 * code (see code-markers.ts in @lintel/builder-model). Scripts are always taken out; the
 * old site's interactions and animations don't come across.
 */
export interface DesignedPageResult {
  document: PageDocument;
  /** How many code blocks the page became. */
  blocks: number;
  /** Texts and pictures people can change without code. */
  editableTexts: number;
  editablePictures: number;
  /** The old site's styles were too long to keep whole. */
  stylesCutShort: boolean;
}

export interface PlacedPicture {
  /** The picture's address in the media library. */
  src: string;
  assetId: string;
  alt: string;
}

const textTags = new Set([
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "li",
  "a",
  "button",
  "blockquote",
  "figcaption",
  "label",
  "span",
  "strong",
  "em",
  "small",
]);
const leftOutTags = new Set(["script", "noscript", "template", "iframe", "object", "embed"]);

/**
 * `pictureFor` gives a picture brought into the media library for an address in the HTML,
 * or null to keep the old address.
 */
export function designedPageFromHtml(
  html: string,
  css: string,
  pictureFor: (address: string) => PlacedPicture | null,
): DesignedPageResult {
  const body = findBody(parseHtml(html));
  const counter = { text: 0, picture: 0 };
  const images: Record<string, PlacedPicture> = {};
  const parts = splitIntoParts(body)
    .map((part) => markEditableParts(part, counter, images, pictureFor))
    .map((part) => removeScriptsFromHtml(writeHtml([part])).trim())
    .filter((part) => part !== "");
  const styles = splitCss(removeImports(css));

  const page = createEmptyPage();
  const children: PageNode[] = parts.map((partHtml, index) => {
    const pictures = Object.fromEntries(
      Object.entries(images)
        .filter(([name]) => partHtml.includes(`data-lintel-image="${name}"`))
        .map(([name, picture]) => [name, { ...picture }]),
    );
    return {
      id: `imported-${index + 1}`,
      type: "codeBlock",
      name: `Imported part ${index + 1}`,
      props: {
        html: partHtml.slice(0, maxCodeLength),
        css: styles[index] ?? "",
        js: "",
        fields: {},
        images: pictures,
      },
      styles: { base: {} },
      children: [],
      hidden: false,
      locked: false,
    };
  });
  return {
    document: { ...page, root: { ...page.root, children } },
    blocks: children.length,
    editableTexts: counter.text,
    editablePictures: counter.picture,
    stylesCutShort: styles.length > Math.max(children.length, 1),
  };
}

function findBody(nodes: readonly HtmlNode[]): HtmlNode[] {
  let body: HtmlElement | undefined;
  const search = (list: readonly HtmlNode[]) => {
    for (const node of list) {
      if (node.kind !== "element" || body) continue;
      if (node.tag === "body") body = node;
      else search(node.children);
    }
  };
  search(nodes);
  const children = body ? body.children : nodes;
  return children.filter((node) => !(node.kind === "element" && node.tag === "head"));
}

/** Each top-level element is a part, unless it alone is too big for a code block. */
function splitIntoParts(nodes: readonly HtmlNode[]): HtmlElement[] {
  const parts: HtmlElement[] = [];
  for (const node of nodes) {
    if (node.kind !== "element" || leftOutTags.has(node.tag) || node.tag === "style") continue;
    const size = writeHtml([node]).length;
    const elementChildren = node.children.filter((child) => child.kind === "element");
    if (size > maxCodeLength && elementChildren.length > 1) {
      parts.push(...splitIntoParts(node.children));
    } else {
      parts.push(node);
    }
  }
  return parts.slice(0, 200);
}

function markEditableParts(
  element: HtmlElement,
  counter: { text: number; picture: number },
  images: Record<string, PlacedPicture>,
  pictureFor: (address: string) => PlacedPicture | null,
): HtmlElement {
  if (leftOutTags.has(element.tag)) {
    return { ...element, children: [] };
  }
  let attributes = element.attributes.filter(([name]) => !/^on/i.test(name));
  if (element.tag === "img") {
    const placed = pictureFor(attributeOf(element, "src") ?? "");
    counter.picture += 1;
    const name = `picture-${counter.picture}`;
    attributes = attributes.filter(([attribute]) => !["srcset", "sizes"].includes(attribute));
    if (placed) {
      attributes = attributes.map(([attribute, value]) =>
        attribute === "src" ? [attribute, placed.src] : [attribute, value],
      );
      images[name] = { ...placed, alt: attributeOf(element, "alt") ?? placed.alt };
    }
    return { ...element, attributes: [...attributes, ["data-lintel-image", name]] };
  }
  const onlyText = element.children.every((child) => child.kind === "text");
  if (textTags.has(element.tag) && onlyText && textContent(element).trim() !== "") {
    counter.text += 1;
    return {
      ...element,
      attributes: [...attributes, ["data-lintel-field", `text-${counter.text}`]],
    };
  }
  return {
    ...element,
    attributes,
    children: element.children.map((child) =>
      child.kind === "element" ? markEditableParts(child, counter, images, pictureFor) : child,
    ),
  };
}

/** Font and stylesheet imports would fetch from the old site; they're left out. */
function removeImports(css: string): string {
  return css.replace(/@import[^;]*;/gi, "");
}

/** CSS shared out between code blocks, each part under the limit, split between rules. */
export function splitCss(css: string): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const rule of css.split(/(?<=\})\s*\n?/)) {
    if (current.length + rule.length + 1 > maxCodeLength) {
      if (current) chunks.push(current);
      current = rule.slice(0, maxCodeLength);
    } else {
      current = current ? `${current}\n${rule}` : rule;
    }
  }
  if (current.trim()) chunks.push(current);
  return chunks;
}
