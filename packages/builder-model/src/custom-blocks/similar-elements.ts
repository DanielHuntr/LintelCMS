import type { ComponentCatalogue } from "../components/component-catalogue.js";
import type { PageNode } from "../document/page-document.schema.js";
import { type BlockProperty, customBlockType } from "./custom-block.js";
import { buildBlockDesign, findPropertyCandidates, type PropertyChoice } from "./make-block.js";

/**
 * "Make these one component": several elements built the same way (eight rows of a project
 * list, each a number, a title, a client and a year) become one component, with the words,
 * pictures and links that differ between them as its properties. The first becomes the
 * component's design; every one becomes an instance keeping its own words.
 *
 * Similar means the same kinds of element nested the same way. They're found from one
 * element: the others using its shared style, or else its siblings.
 */

/** The kinds of element nested in a node, as one string to compare: `box(text,heading)`. */
export function shapeOf(node: PageNode): string {
  return node.children.length === 0
    ? node.type
    : `${node.type}(${node.children.map(shapeOf).join(",")})`;
}

/**
 * Elements built like this one, in page order and including it: those with its shared style,
 * or, without one, its siblings. Empty when there aren't at least two, or when it is (or
 * holds) a component already.
 */
export function findSimilarElements(root: PageNode, nodeId: string): PageNode[] {
  const node = findNode(root, nodeId);
  if (!node || node.type === "page" || holdsComponent(node)) return [];
  const shape = shapeOf(node);
  const similar: PageNode[] = [];
  if (node.sharedStyle) {
    const visit = (candidate: PageNode) => {
      if (candidate.sharedStyle === node.sharedStyle && shapeOf(candidate) === shape) {
        if (!holdsComponent(candidate)) similar.push(candidate);
        return;
      }
      candidate.children.forEach(visit);
    };
    visit(root);
  } else {
    const parent = findParent(root, nodeId);
    for (const sibling of parent?.children ?? []) {
      if (shapeOf(sibling) === shape && !holdsComponent(sibling)) similar.push(sibling);
    }
  }
  return similar.length >= 2 ? similar : [];
}

/** One property found from what differs, with what each element had. */
export interface DifferingPart {
  handle: string;
  label: string;
  /** What each element shows there, in the elements' order. */
  shown: string[];
}

export interface ComponentFromSimilar {
  design: PageNode;
  properties: BlockProperty[];
  /** Each element's values for the properties, by element id. */
  values: Record<string, Record<string, unknown>>;
  /** For "what will happen": each property and what every element keeps in it. */
  parts: DifferingPart[];
}

/**
 * The component the elements would make: the first one's design, with a property for each
 * word, picture or link that differs between them, and each element's own values. A picture
 * becomes a property only when every one is from the media library (properties hold its id).
 */
export function planComponentFromSimilar(
  elements: readonly PageNode[],
  catalogue: ComponentCatalogue,
): ComponentFromSimilar | null {
  const [first] = elements;
  if (!first || elements.length < 2) return null;
  const firstPaths = pathsById(first);
  const candidates = findPropertyCandidates(first, catalogue).filter(
    (candidate) =>
      candidate.kind === "text" ||
      candidate.kind === "multilineText" ||
      candidate.kind === "image" ||
      candidate.kind === "link",
  );

  const chosen: Array<{ choice: PropertyChoice; read: (element: PageNode) => unknown }> = [];
  for (const candidate of candidates) {
    const path = firstPaths.get(candidate.nodeId);
    if (path === undefined) continue;
    const at = (element: PageNode) => nodeAtPath(element, path);
    const raw = elements.map((element) => at(element)?.props[candidate.binding]);
    if (raw.every((value) => JSON.stringify(value) === JSON.stringify(raw[0]))) continue;
    let read: (element: PageNode) => unknown;
    if (candidate.kind === "image") {
      const ids = elements.map((element) => at(element)?.props.assetId);
      if (!ids.every((id) => typeof id === "string" && id !== "")) continue;
      read = (element) => at(element)?.props.assetId;
    } else if (candidate.kind === "link") {
      read = (element) => ({ url: String(at(element)?.props[candidate.binding] ?? "") });
    } else {
      read = (element) => String(at(element)?.props[candidate.binding] ?? "");
    }
    chosen.push({ choice: { candidateId: candidate.id, label: candidate.suggestedLabel }, read });
  }

  const { design, properties } = buildBlockDesign(
    first,
    chosen.map((each) => each.choice),
    catalogue,
  );
  const values: Record<string, Record<string, unknown>> = {};
  for (const element of elements) {
    values[element.id] = Object.fromEntries(
      chosen.map((each, index) => [properties[index]?.handle ?? "", each.read(element)]),
    );
  }
  const parts = chosen.map((each, index) => ({
    handle: properties[index]?.handle ?? "",
    label: properties[index]?.label ?? "",
    shown: elements.map((element) => {
      const value = each.read(element);
      return typeof value === "object" && value !== null
        ? String((value as { url?: unknown }).url ?? "")
        : String(value ?? "");
    }),
  }));
  return { design, properties, values, parts };
}

function holdsComponent(node: PageNode): boolean {
  return node.type === customBlockType || node.children.some(holdsComponent);
}

function findNode(node: PageNode, id: string): PageNode | undefined {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return undefined;
}

function findParent(node: PageNode, id: string): PageNode | undefined {
  if (node.children.some((child) => child.id === id)) return node;
  for (const child of node.children) {
    const found = findParent(child, id);
    if (found) return found;
  }
  return undefined;
}

/** Each element's position inside the node, as child indexes. */
function pathsById(node: PageNode, path: number[] = [], into = new Map<string, number[]>()) {
  into.set(node.id, path);
  node.children.forEach((child, index) => pathsById(child, [...path, index], into));
  return into;
}

function nodeAtPath(node: PageNode, path: readonly number[]): PageNode | undefined {
  let current: PageNode | undefined = node;
  for (const index of path) current = current?.children[index];
  return current;
}
