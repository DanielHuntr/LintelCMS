import type { CodeImage } from "../components/component-props.js";
import { isSafeImageAddress } from "../components/component-props.js";
import {
  attributeOf,
  type HtmlElement,
  parseHtml,
  textContent,
  walkElements,
} from "../html/html-parser.js";
import { writeHtml } from "../html/html-writer.js";

/**
 * The editable parts of a code block. A developer writes
 *
 *   <h2 data-lintel-field="heading">Our story</h2>
 *   <img data-lintel-image="photo" src="/team.jpg" alt="The team">
 *
 * and everyone else sees "heading" as a text box and "photo" as a picture chooser in the
 * Content panel. What they choose is stored next to the code (`fields`, `images`) and put in
 * place by `fillCodeMarkers` when the page is drawn; the code itself never changes.
 */

export interface CodeMarker {
  kind: "field" | "image";
  name: string;
  /** What the HTML itself says: the element's text, or the image's src and alt. */
  defaultText: string;
  defaultImage: CodeImage | null;
}

export function findCodeMarkers(html: string): CodeMarker[] {
  const markers: CodeMarker[] = [];
  const seen = new Set<string>();
  walkElements(parseHtml(html), (element) => {
    const field = attributeOf(element, "data-lintel-field");
    if (field && !seen.has(`field:${field}`)) {
      seen.add(`field:${field}`);
      markers.push({
        kind: "field",
        name: field,
        defaultText: textContent(element).trim(),
        defaultImage: null,
      });
    }
    const image = attributeOf(element, "data-lintel-image");
    if (image && element.tag === "img" && !seen.has(`image:${image}`)) {
      seen.add(`image:${image}`);
      markers.push({
        kind: "image",
        name: image,
        defaultText: "",
        defaultImage: {
          src: attributeOf(element, "src") ?? "",
          alt: attributeOf(element, "alt") ?? "",
          assetId: null,
        },
      });
    }
  });
  return markers;
}

/** The code block's HTML with the values people chose put into the marked elements. */
export function fillCodeMarkers(
  html: string,
  fields: Readonly<Record<string, string>>,
  images: Readonly<Record<string, CodeImage>>,
): string {
  if (Object.keys(fields).length === 0 && Object.keys(images).length === 0) return html;
  const nodes = parseHtml(html);
  walkElements(nodes, (element) => {
    const field = attributeOf(element, "data-lintel-field");
    const text = field === undefined ? undefined : fields[field];
    if (text !== undefined) element.children = [{ kind: "text", text }];

    const image = attributeOf(element, "data-lintel-image");
    const chosen = image === undefined ? undefined : images[image];
    if (chosen && element.tag === "img" && isSafeImageAddress(chosen.src)) {
      setAttribute(element, "src", chosen.src);
      setAttribute(element, "alt", chosen.alt);
    }
  });
  return writeHtml(nodes);
}

function setAttribute(element: HtmlElement, name: string, value: string): void {
  const existing = element.attributes.find(([attribute]) => attribute === name);
  if (existing) existing[1] = value;
  else element.attributes.push([name, value]);
}
