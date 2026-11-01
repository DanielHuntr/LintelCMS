/**
 * A small, forgiving HTML parser in plain TypeScript, so pasted HTML and code blocks can be
 * read on the server as well as in the browser. It understands elements, attributes, text,
 * comments, void elements (`<img>`), raw text elements (`<script>`, `<style>`) and character
 * references. Unclosed elements are closed by their parent's end tag, and stray end tags are
 * ignored, which is how browsers treat the HTML people usually paste.
 */

export interface HtmlElement {
  kind: "element";
  tag: string;
  attributes: Array<[name: string, value: string]>;
  children: HtmlNode[];
}

export interface HtmlText {
  kind: "text";
  text: string;
}

export interface HtmlComment {
  kind: "comment";
  text: string;
}

export type HtmlNode = HtmlElement | HtmlText | HtmlComment;

export const voidElements = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
]);

const rawTextElements = new Set(["script", "style", "textarea", "title"]);

const namedReferences: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  copy: "©",
  reg: "®",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  trade: "™",
};

export function decodeCharacterReferences(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (reference, name: string) => {
    if (name.startsWith("#")) {
      const code =
        name[1]?.toLowerCase() === "x" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : reference;
    }
    return namedReferences[name.toLowerCase()] ?? reference;
  });
}

const attributePattern = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function parseAttributes(source: string): Array<[string, string]> {
  const attributes: Array<[string, string]> = [];
  for (const match of source.matchAll(attributePattern)) {
    const name = (match[1] ?? "").toLowerCase();
    if (name === "" || attributes.some(([existing]) => existing === name)) continue;
    attributes.push([name, decodeCharacterReferences(match[2] ?? match[3] ?? match[4] ?? "")]);
  }
  return attributes;
}

export function parseHtml(source: string): HtmlNode[] {
  const root: HtmlElement = { kind: "element", tag: "#root", attributes: [], children: [] };
  const open: HtmlElement[] = [root];
  const current = () => open[open.length - 1] as HtmlElement;
  const addText = (text: string) => {
    if (text === "") return;
    const siblings = current().children;
    const last = siblings[siblings.length - 1];
    if (last?.kind === "text") last.text += decodeCharacterReferences(text);
    else siblings.push({ kind: "text", text: decodeCharacterReferences(text) });
  };

  let position = 0;
  while (position < source.length) {
    const tagStart = source.indexOf("<", position);
    if (tagStart === -1) {
      addText(source.slice(position));
      break;
    }
    addText(source.slice(position, tagStart));

    if (source.startsWith("<!--", tagStart)) {
      const end = source.indexOf("-->", tagStart + 4);
      const stop = end === -1 ? source.length : end;
      current().children.push({ kind: "comment", text: source.slice(tagStart + 4, stop) });
      position = end === -1 ? source.length : end + 3;
      continue;
    }
    if (source.startsWith("<!", tagStart) || source.startsWith("<?", tagStart)) {
      const end = source.indexOf(">", tagStart);
      position = end === -1 ? source.length : end + 1;
      continue;
    }

    const endTag = /^<\/([a-zA-Z][\w:-]*)\s*>/.exec(source.slice(tagStart));
    if (endTag) {
      const tag = (endTag[1] ?? "").toLowerCase();
      const openIndex = open.map((element) => element.tag).lastIndexOf(tag);
      if (openIndex > 0) open.length = openIndex;
      position = tagStart + endTag[0].length;
      continue;
    }

    const startTag = /^<([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/.exec(
      source.slice(tagStart),
    );
    if (!startTag) {
      addText("<");
      position = tagStart + 1;
      continue;
    }
    const tag = (startTag[1] ?? "").toLowerCase();
    const attributeSource = (startTag[2] ?? "").replace(/\/\s*$/, "");
    const element: HtmlElement = {
      kind: "element",
      tag,
      attributes: parseAttributes(attributeSource),
      children: [],
    };
    current().children.push(element);
    position = tagStart + startTag[0].length;

    if (voidElements.has(tag) || /\/\s*$/.test(startTag[2] ?? "")) continue;
    if (rawTextElements.has(tag)) {
      const closing = new RegExp(`</${tag}\\s*>`, "i").exec(source.slice(position));
      const stop = closing ? position + closing.index : source.length;
      const text = source.slice(position, stop);
      if (text !== "")
        element.children.push({
          kind: "text",
          text: tag === "textarea" || tag === "title" ? decodeCharacterReferences(text) : text,
        });
      position = closing ? stop + closing[0].length : source.length;
      continue;
    }
    open.push(element);
  }
  return root.children;
}

export function attributeOf(element: HtmlElement, name: string): string | undefined {
  return element.attributes.find(([attribute]) => attribute === name)?.[1];
}

/** The text inside a node, as a reader would see it: tags dropped, white space collapsed. */
export function textContent(node: HtmlNode): string {
  if (node.kind === "text") return node.text;
  if (node.kind === "comment") return "";
  if (node.tag === "br") return "\n";
  if (node.tag === "script" || node.tag === "style") return "";
  return node.children.map(textContent).join("");
}

export function collapseWhiteSpace(text: string): string {
  return text
    .replace(/[ \t\r\f]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

/** Visits every element, parents first. */
export function walkElements(
  nodes: readonly HtmlNode[],
  visit: (element: HtmlElement) => void,
): void {
  for (const node of nodes) {
    if (node.kind !== "element") continue;
    visit(node);
    walkElements(node.children, visit);
  }
}
