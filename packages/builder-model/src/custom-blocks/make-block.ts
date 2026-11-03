import type { ComponentCatalogue } from "../components/component-catalogue.js";
import type { PageNode } from "../document/page-document.schema.js";
import {
  bindableColourStyles,
  itemsBinding,
  styleBindingPrefix,
  visibleBinding,
} from "./block-bindings.js";
import { type BlockProperty, customBlockType } from "./custom-block.js";

/**
 * "Make into a block": the parts of a design an editor could make editable, and the block
 * made from the ones chosen. Each candidate is one binding on one element:
 *
 *   heading "Name"     text        → a Text property, `{ "text": "name" }`
 *   picture "Photo"    picture     → an Image property, `{ "src": "photo" }`
 *   button             link        → a Link property, `{ "href": "button_link" }`
 *   badge              show/hide   → a Toggle property, `{ "visible": "show_badge" }`
 *   box                colour      → a Colour property, `{ "style.backgroundColor": "accent" }`
 *   list of cards      repeat      → a Repeater property, `{ "items": "people" }`, whose
 *                                    rows have the first card's words and pictures
 */

export type CandidateKind =
  "text" | "multilineText" | "image" | "link" | "visible" | "colour" | "items";

export interface PropertyCandidate {
  /** `<node id>:<binding>`: what the editor ticks. */
  id: string;
  nodeId: string;
  /** The element's name in Layers: "Heading", "Photo". */
  elementName: string;
  binding: string;
  kind: CandidateKind;
  /** A label to start from: the element's layer name, or what the field is called. */
  suggestedLabel: string;
  /** What it shows now, for the list ("Ada Lovelace", a picture's address). */
  currentValue: string;
}

/** What the editor chose for one candidate. */
export interface PropertyChoice {
  candidateId: string;
  label: string;
}

/**
 * The field type a candidate becomes. Words that fit on one line (a heading, a role) become
 * a Text field even where the element allows several lines; longer ones a Text area.
 */
function fieldtypeOf(candidate: Pick<PropertyCandidate, "kind" | "currentValue">): string {
  if (candidate.kind === "multilineText") {
    const isShort = candidate.currentValue.length <= 80 && !candidate.currentValue.includes("\n");
    return isShort ? "text" : "textarea";
  }
  return fieldtypeFor[candidate.kind];
}

const fieldtypeFor: Record<CandidateKind, string> = {
  text: "text",
  multilineText: "textarea",
  image: "image",
  link: "link",
  visible: "toggle",
  colour: "colour",
  items: "repeater",
};

/** Everything in `design` that could be a property, in Layers order. */
export function findPropertyCandidates(
  design: PageNode,
  catalogue: ComponentCatalogue,
): PropertyCandidate[] {
  const candidates: PropertyCandidate[] = [];
  const visit = (node: PageNode, isTop: boolean, insideList: boolean) => {
    const definition = catalogue.find(node.type);
    const elementName = node.name || definition?.label || node.type;
    const add = (
      binding: string,
      kind: CandidateKind,
      suggestedLabel: string,
      currentValue: string,
    ) =>
      candidates.push({
        id: `${node.id}:${binding}`,
        nodeId: node.id,
        elementName,
        binding,
        kind,
        suggestedLabel,
        currentValue,
      });
    for (const field of definition?.editableFields ?? []) {
      if (
        field.kind !== "text" &&
        field.kind !== "multilineText" &&
        field.kind !== "image" &&
        field.kind !== "link"
      ) {
        continue;
      }
      // A picture's description goes with the picture; a button's words with its link.
      if (
        field.prop === "alt" &&
        definition?.editableFields.some((other) => other.kind === "image")
      )
        continue;
      const label = node.name && field.kind !== "link" ? node.name : field.label;
      add(field.prop, field.kind, label, String(node.props[field.prop] ?? ""));
    }
    if (!isTop && !insideList)
      add(visibleBinding, "visible", `Show ${elementName.toLowerCase()}`, "");
    for (const style of bindableColourStyles) {
      const value = node.styles.base[style];
      if (value) add(`${styleBindingPrefix}${style}`, "colour", `${elementName} colour`, value);
    }
    if (isRepeating(node)) add(itemsBinding, "items", elementName, `${node.children.length}`);
    node.children.forEach((child) => visit(child, false, insideList || isRepeating(node)));
  };
  visit(design, true, false);
  return candidates;
}

/** Two or more children of the same kind, such as cards in a grid, can become a list. */
function isRepeating(node: PageNode): boolean {
  const [first, ...rest] = node.children;
  return first !== undefined && rest.length > 0 && rest.every((child) => child.type === first.type);
}

/** `Show LinkedIn` → `show_linkedin`, unique among `taken`. */
export function handleFromLabel(label: string, taken: ReadonlySet<string>): string {
  const base =
    label
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/^(\d)/, "p_$1")
      .slice(0, 60) || "property";
  let handle = base;
  for (let count = 2; taken.has(handle); count += 1) handle = `${base}_${count}`;
  return handle;
}

/**
 * The block's design and properties from the elements chosen and what was ticked. The
 * design keeps its own words and pictures, which show until an editor fills a property in;
 * bindings it had to an entry's fields are dropped, since a block's bindings name properties.
 * A list keeps its first child as the design of each row.
 */
export function buildBlockDesign(
  selection: PageNode,
  choices: readonly PropertyChoice[],
  catalogue: ComponentCatalogue,
): { design: PageNode; properties: BlockProperty[] } {
  const candidates = new Map(
    findPropertyCandidates(selection, catalogue).map((candidate) => [candidate.id, candidate]),
  );
  const taken = new Set<string>();
  const handles = new Map<string, string>();
  const properties: BlockProperty[] = [];
  const lists = new Map<string, BlockProperty>();
  // Inside a list, the first row's parts become the row's fields; ticks there are left out.
  const insideLists = new Set<string>();
  for (const choice of choices) {
    const candidate = candidates.get(choice.candidateId);
    if (candidate?.kind !== "items") continue;
    const list = findInTree(selection, candidate.nodeId);
    list?.children.forEach((child) => collectIds(child, insideLists));
  }

  for (const choice of choices) {
    const candidate = candidates.get(choice.candidateId);
    if (!candidate || insideLists.has(candidate.nodeId)) continue;
    const label = choice.label.trim() || candidate.suggestedLabel;
    const handle = handleFromLabel(label, taken);
    taken.add(handle);
    handles.set(candidate.id, handle);
    const property: BlockProperty = {
      handle,
      label,
      type: fieldtypeOf(candidate),
      required: false,
      helpText: "",
      options: {},
      ...(candidate.kind === "visible" ? { default: true } : {}),
    };
    properties.push(property);
    if (candidate.kind === "items") lists.set(candidate.nodeId, property);
  }

  const bind = (node: PageNode): PageNode => {
    const bindings: Record<string, string> = {};
    for (const [candidateId, handle] of handles) {
      const [nodeId, binding] = splitCandidateId(candidateId);
      if (nodeId !== node.id || !binding) continue;
      bindings[binding] = handle;
    }
    const list = lists.get(node.id);
    let children = node.children;
    if (list) {
      const first = node.children[0];
      const fields: BlockProperty[] = [];
      children = first ? [bindRow(first, fields, catalogue)] : [];
      (list as { options: Record<string, unknown> }).options = { fields };
    }
    const bound: PageNode = {
      ...node,
      children: list ? children : children.map(bind),
    };
    delete bound.bindings;
    if (Object.keys(bindings).length > 0) bound.bindings = bindings;
    return bound;
  };

  return { design: bind(selection), properties };
}

/** A list's row design: each of its words, pictures and links becomes one of the row's fields. */
function bindRow(row: PageNode, fields: BlockProperty[], catalogue: ComponentCatalogue): PageNode {
  const taken = new Set<string>();
  const candidates = findPropertyCandidates(row, catalogue).filter(
    (candidate) =>
      candidate.kind !== "visible" && candidate.kind !== "items" && candidate.kind !== "colour",
  );
  const byNode = new Map<string, Record<string, string>>();
  for (const candidate of candidates) {
    const handle = handleFromLabel(candidate.suggestedLabel, taken);
    taken.add(handle);
    fields.push({
      handle,
      label: candidate.suggestedLabel,
      type: fieldtypeOf(candidate),
      required: false,
      helpText: "",
      options: {},
    });
    byNode.set(candidate.nodeId, { ...byNode.get(candidate.nodeId), [candidate.binding]: handle });
  }
  const bind = (node: PageNode): PageNode => {
    const bound: PageNode = { ...node, children: node.children.map(bind) };
    delete bound.bindings;
    const bindings = byNode.get(node.id);
    if (bindings) bound.bindings = bindings;
    return bound;
  };
  return bind(row);
}

function findInTree(node: PageNode, nodeId: string): PageNode | undefined {
  if (node.id === nodeId) return node;
  for (const child of node.children) {
    const found = findInTree(child, nodeId);
    if (found) return found;
  }
  return undefined;
}

function collectIds(node: PageNode, into: Set<string>) {
  into.add(node.id);
  node.children.forEach((child) => collectIds(child, into));
}

function splitCandidateId(candidateId: string): [string, string | undefined] {
  const at = candidateId.indexOf(":");
  return at === -1
    ? [candidateId, undefined]
    : [candidateId.slice(0, at), candidateId.slice(at + 1)];
}

/** Why a selection can't be made into a block, or null when it can. */
export function cannotMakeBlockFrom(node: PageNode): "page" | "hasBlock" | null {
  if (node.type === "page") return "page";
  const hasBlock = (candidate: PageNode): boolean =>
    candidate.type === customBlockType || candidate.children.some(hasBlock);
  return hasBlock(node) ? "hasBlock" : null;
}
