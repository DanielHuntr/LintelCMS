import type { ComponentCatalogue } from "../components/component-catalogue.js";
import type { ListOfItemsField } from "../components/component-definition.js";
import {
  createEmptyPage,
  type PageDocument,
  type PageNode,
} from "../document/page-document.schema.js";
import type { TextMark } from "../text-marks/text-marks.js";
import { clientEditsOf, contentKindOfField, contentKindOfProp } from "./client-content.js";

/**
 * Checks a client's save against the design stored before it. A client may change only the
 * content their designer opened up (see client-content.ts): words, pictures and links in
 * the elements that allow them, and add or remove items where "Clients can add more of
 * these" is on. Anything else (styles, layout, animation, new or moved elements, the
 * designer's own settings) is a design change, and is listed here so the save is refused.
 *
 * Both pages should already be checked and migrated (`validatePageDocument`), so their
 * props are complete and comparable.
 */

export interface DesignChange {
  /** The element changed, or null for the page itself. */
  nodeId: string | null;
  /** The element's name, as the Layers panel shows it. */
  where: string;
}

export function findDesignChanges(
  previous: PageDocument | null,
  next: PageDocument,
  catalogue: ComponentCatalogue,
): DesignChange[] {
  const changes: DesignChange[] = [];
  compareNodes((previous ?? createEmptyPage()).root, next.root, catalogue, changes);
  return changes;
}

/** Everything about a node apart from its id, its props and its children. */
function designOf(node: PageNode): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(node).filter(([key]) => key !== "id" && key !== "props" && key !== "children"),
  );
}

function nameOf(node: PageNode, catalogue: ComponentCatalogue): string {
  return node.name || catalogue.find(node.type)?.label || node.type;
}

function compareNodes(
  before: PageNode,
  after: PageNode,
  catalogue: ComponentCatalogue,
  changes: DesignChange[],
): void {
  const changed = () =>
    changes.push({
      nodeId: after.id === "page" ? null : after.id,
      where: nameOf(after, catalogue),
    });
  if (!sameValue(designOf(before), designOf(after))) {
    changed();
    return;
  }
  const definition = catalogue.find(before.type);
  const allowed = clientEditsOf(before, definition);
  const props = new Set([...Object.keys(before.props), ...Object.keys(after.props)]);
  for (const prop of props) {
    const old = before.props[prop];
    const now = after.props[prop];
    if (sameValue(old, now)) continue;
    const kind = before.bindings?.[prop] ? null : contentKindOfProp(definition, prop);
    if (kind === "items") {
      const field = definition?.editableFields.find((each) => each.prop === prop);
      if (
        field?.kind !== "itemList" ||
        !itemsChangeAllowed(old, now, field, allowed, before.clientRepeats === true)
      ) {
        changed();
        return;
      }
    } else if (kind === null || !allowed.has(kind)) {
      changed();
      return;
    } else if (prop === "marks" && !marksKeepTheirLooks(old, now, allowed.has("links"))) {
      changed();
      return;
    }
  }
  compareChildren(before, after, catalogue, changes);
}

function compareChildren(
  before: PageNode,
  after: PageNode,
  catalogue: ComponentCatalogue,
  changes: DesignChange[],
): void {
  const sameIds =
    before.children.length === after.children.length &&
    before.children.every((child, index) => after.children[index]?.id === child.id);
  if (sameIds) {
    before.children.forEach((child, index) =>
      compareNodes(child, after.children[index] as PageNode, catalogue, changes),
    );
    return;
  }
  const changed = () => changes.push({ nodeId: after.id, where: nameOf(after, catalogue) });
  // Adding and removing items is only for elements whose designer allowed it, and leaves
  // at least one, so there is always something to copy.
  if (!before.clientRepeats || (before.children.length > 0 && after.children.length === 0)) {
    changed();
    return;
  }
  const beforeById = new Map(before.children.map((child) => [child.id, child]));
  const kept = after.children.filter((child) => beforeById.has(child.id));
  const keptOrder = before.children.filter((child) => kept.some((each) => each.id === child.id));
  if (keptOrder.some((child, index) => kept[index]?.id !== child.id)) {
    changed();
    return;
  }
  for (const child of after.children) {
    const original = beforeById.get(child.id);
    if (original) {
      compareNodes(original, child, catalogue, changes);
    } else if (!before.children.some((sibling) => isCopyOf(sibling, child, catalogue))) {
      changes.push({ nodeId: child.id, where: nameOf(child, catalogue) });
    }
  }
}

/**
 * Whether `copy` is a copy of `original` (as Duplicate makes it: new ids throughout, with
 * what pointed inside it pointed at the copy), with at most allowed content changed.
 */
function isCopyOf(original: PageNode, copy: PageNode, catalogue: ComponentCatalogue): boolean {
  const originalIds = positionalIds(original);
  const copyIds = positionalIds(copy);
  if (originalIds.size !== copyIds.size) return false;
  const changes: DesignChange[] = [];
  compareNodes(
    replaceIds(original, originalIds) as PageNode,
    replaceIds(copy, copyIds) as PageNode,
    catalogue,
    changes,
  );
  return changes.length === 0;
}

/** Each id in the node's tree, to a name for where it is ("#", "#.0", "#.0.1"). */
function positionalIds(node: PageNode, at = "#", ids = new Map<string, string>()) {
  ids.set(node.id, at);
  node.children.forEach((child, index) => positionalIds(child, `${at}.${index}`, ids));
  return ids;
}

/** A copy of a value with every mention of the ids (as a value, or as "hover@id") replaced. */
function replaceIds(value: unknown, ids: ReadonlyMap<string, string>): unknown {
  if (typeof value === "string") return ids.get(value) ?? value;
  if (Array.isArray(value)) return value.map((each) => replaceIds(each, ids));
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, each]) => {
        const [state, ownerId] = key.split("@");
        const movedKey =
          ownerId !== undefined && ids.has(ownerId) ? `${state}@${ids.get(ownerId)}` : key;
        return [movedKey, replaceIds(each, ids)];
      }),
    );
  }
  return value;
}

/**
 * A list of items (a gallery's pictures): the same number, with only allowed fields
 * changed; or, where clients may add and remove items, any number, each a copy of one
 * that was there (or of a new item) with only allowed fields changed.
 */
function itemsChangeAllowed(
  before: unknown,
  after: unknown,
  field: ListOfItemsField,
  allowed: ReadonlySet<string>,
  repeats: boolean,
): boolean {
  const oldItems = Array.isArray(before) ? before : [];
  const newItems = Array.isArray(after) ? after : [];
  const sameShape = (old: unknown, now: unknown) => itemChangeAllowed(old, now, field, allowed);
  if (oldItems.length === newItems.length) {
    return oldItems.every((old, index) => sameShape(old, newItems[index]));
  }
  if (!repeats || (oldItems.length > 0 && newItems.length === 0)) return false;
  const models = [...oldItems, field.newItem];
  return newItems.every((now) => models.some((model) => sameShape(model, now)));
}

function itemChangeAllowed(
  before: unknown,
  after: unknown,
  field: ListOfItemsField,
  allowed: ReadonlySet<string>,
): boolean {
  const old = asRecord(before);
  const now = asRecord(after);
  for (const key of new Set([...Object.keys(old), ...Object.keys(now)])) {
    if (sameValue(old[key], now[key])) continue;
    const itemField = field.fields.find((each) => each.prop === key);
    const kind = itemField ? contentKindOfField(itemField) : null;
    if (kind === null || !allowed.has(kind)) return false;
  }
  return true;
}

/**
 * Typing moves a text's styled parts, so they may change with the words; but only to looks
 * the text already had (a client doesn't style text), and their links only where links may
 * change.
 */
function marksKeepTheirLooks(before: unknown, after: unknown, mayChangeLinks: boolean): boolean {
  const old = (Array.isArray(before) ? before : []) as TextMark[];
  const now = (Array.isArray(after) ? after : []) as TextMark[];
  const looks = old.map((mark) => mark.styles);
  const links = new Set(old.map((mark) => mark.href ?? ""));
  return now.every(
    (mark) =>
      looks.some((look) => sameValue(look, mark.styles)) &&
      (mayChangeLinks || links.has(mark.href ?? "")),
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Deep equality for JSON values, ignoring the order of object keys. */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((each, index) => sameValue(each, b[index]));
  }
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    // A key left out and one set to undefined mean the same in JSON.
    if (!sameValue(left[key], right[key])) return false;
  }
  return true;
}
