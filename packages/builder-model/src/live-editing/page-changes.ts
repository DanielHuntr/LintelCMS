import { z } from "zod";
import { sameValue } from "../client-editing/client-changes.js";
import type { PageDocument, PageNode } from "../document/page-document.schema.js";
import { siteSectionNodeIds } from "../site-sections/site-sections.js";
import { normaliseMarks, rebaseMarks, type TextMark } from "../text-marks/text-marks.js";
import { removeNode } from "../tree/tree-changes.js";
import { findNode, findPath, listNodes } from "../tree/tree-queries.js";
import { mergeText } from "./merge-text.js";

/**
 * A page's changes as small steps that can be sent to other people and applied to their copy.
 * Elements keep their ids for life, so a step names the element it is about rather than a
 * place in the tree, and still means the same after someone else has moved things around:
 *
 *   - `set` one value of an element: one prop, one style in one screen size, its name...;
 *   - `text` changes words, and keeps the other person's changes to the same words;
 *   - `insert`, `move` and `remove` an element, placed after a sibling rather than at a number.
 *
 * `diffPages` works out the steps between two versions of a page, which is what lets the
 * builder's commands stay as they are. `applyPageChanges` is pure and deterministic: given the
 * same page and steps it gives the same page, here and on the server. A step about something
 * that has gone (an element someone else removed) does nothing, so it can't fail.
 *
 * See docs/decisions/0067-working-together-on-a-page.md.
 */

export type PageChange =
  /** `value` left out takes the value away. */
  | { op: "set"; node: string; path: readonly string[]; value?: unknown }
  | { op: "text"; node: string; prop: string; from: string; to: string }
  /** `after` is the sibling it goes after; null is first. */
  | { op: "insert"; parent: string; after: string | null; node: PageNode }
  | { op: "move"; node: string; parent: string; after: string | null }
  | { op: "remove"; node: string };

/** The most steps one message may hold. Far more than a template's worth. */
export const maxChangesInBatch = 5000;

const nodeIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const dangerousKeys = new Set(["__proto__", "prototype", "constructor"]);
const pathPartSchema = z
  .string()
  .min(1)
  .max(200)
  .refine((part) => !dangerousKeys.has(part));

/** A node in `insert` is only looked at here; the page it lands in is checked as a whole. */
export const pageChangeSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("set"),
    node: nodeIdSchema,
    path: z.array(pathPartSchema).min(1).max(4),
    value: z.unknown().optional(),
  }),
  z.object({
    op: z.literal("text"),
    node: nodeIdSchema,
    prop: pathPartSchema,
    from: z.string(),
    to: z.string(),
  }),
  z.object({
    op: z.literal("insert"),
    parent: nodeIdSchema,
    after: nodeIdSchema.nullable(),
    node: z.custom<PageNode>(isNodeShaped),
  }),
  z.object({
    op: z.literal("move"),
    node: nodeIdSchema,
    parent: nodeIdSchema,
    after: nodeIdSchema.nullable(),
  }),
  z.object({ op: z.literal("remove"), node: nodeIdSchema }),
]);

function isNodeShaped(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const node = value as Partial<PageNode>;
  return typeof node.id === "string" && Array.isArray(node.children);
}

export const pageChangesSchema = z.array(pageChangeSchema).max(maxChangesInBatch);

const notValues = new Set(["id", "children"]);

/** The steps that turn one version of a page into another. */
export function diffPages(before: PageDocument, after: PageDocument): PageChange[] {
  if (before.root === after.root) return [];
  const known = indexNodes(before.root);
  const stillHere = new Set(listNodes(after.root).map((node) => node.id));
  const changes: PageChange[] = [];
  compareElement(before.root, after.root, known, changes);
  for (const [id, { node, parentId }] of known) {
    if (stillHere.has(node.id)) continue;
    // Taking away a parent takes what's in it, so only the outermost is said.
    if (parentId === null || stillHere.has(parentId)) changes.push({ op: "remove", node: id });
  }
  return changes;
}

interface Known {
  node: PageNode;
  parentId: string | null;
}

function indexNodes(root: PageNode): Map<string, Known> {
  const index = new Map<string, Known>();
  const visit = (node: PageNode, parentId: string | null) => {
    index.set(node.id, { node, parentId });
    for (const child of node.children) visit(child, node.id);
  };
  visit(root, null);
  return index;
}

function compareElement(
  before: PageNode | null,
  after: PageNode,
  known: ReadonlyMap<string, Known>,
  changes: PageChange[],
): void {
  if (before === after) return;
  if (before) compareValues(before, after, changes);
  const staying = childrenInPlace(before, after);
  let previous: string | null = null;
  for (const child of after.children) {
    const existing = known.get(child.id);
    if (!existing) {
      insertElement(child, after.id, previous, known, changes);
    } else {
      if (!staying.has(child.id)) {
        changes.push({ op: "move", node: child.id, parent: after.id, after: previous });
      }
      compareElement(existing.node, child, known, changes);
    }
    previous = child.id;
  }
}

/** A new element goes in whole, unless something in it already exists and has to move there. */
function insertElement(
  node: PageNode,
  parent: string,
  after: string | null,
  known: ReadonlyMap<string, Known>,
  changes: PageChange[],
): void {
  if (listNodes(node).every((each) => !known.has(each.id))) {
    changes.push({ op: "insert", parent, after, node });
    return;
  }
  changes.push({ op: "insert", parent, after, node: { ...node, children: [] } });
  compareElement({ ...node, children: [] }, node, known, changes);
}

/** The most children that can stay where they are: the longest run already in the right order. */
function childrenInPlace(before: PageNode | null, after: PageNode): Set<string> {
  if (!before) return new Set();
  const position = new Map(before.children.map((child, index) => [child.id, index]));
  const kept = after.children.filter((child) => position.has(child.id));
  const longestEndingAt: number[] = [];
  const cameFrom: number[] = [];
  let best = -1;
  kept.forEach((child, index) => {
    longestEndingAt[index] = 1;
    cameFrom[index] = -1;
    for (let earlier = 0; earlier < index; earlier += 1) {
      const isInOrder =
        (position.get((kept[earlier] as PageNode).id) as number) <
        (position.get(child.id) as number);
      if (
        isInOrder &&
        (longestEndingAt[earlier] as number) + 1 > (longestEndingAt[index] as number)
      ) {
        longestEndingAt[index] = (longestEndingAt[earlier] as number) + 1;
        cameFrom[index] = earlier;
      }
    }
    if (best === -1 || (longestEndingAt[index] as number) > (longestEndingAt[best] as number)) {
      best = index;
    }
  });
  const staying = new Set<string>();
  for (let index = best; index !== -1; index = cameFrom[index] as number) {
    staying.add((kept[index] as PageNode).id);
  }
  return staying;
}

function compareValues(before: PageNode, after: PageNode, changes: PageChange[]): void {
  const node = after.id;
  for (const key of keysOf(before, after)) {
    if (notValues.has(key)) continue;
    const from = (before as unknown as Record<string, unknown>)[key];
    const to = (after as unknown as Record<string, unknown>)[key];
    if (from === to) continue;
    if (key === "props") compareProps(node, before.props, after.props, changes);
    else if (key === "styles") compareStyles(node, before.styles, after.styles, changes);
    else if (!sameValue(from, to)) changes.push(setStep(node, [key], to));
  }
}

function compareProps(
  node: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  changes: PageChange[],
): void {
  for (const key of keysOf(before, after)) {
    const from = before[key];
    const to = after[key];
    if (sameValue(from, to)) continue;
    if (isWords(from) && isWords(to) && (from.includes(" ") || to.includes(" "))) {
      changes.push({ op: "text", node, prop: key, from, to });
    } else {
      changes.push(setStep(node, ["props", key], to));
    }
  }
}

const isWords = (value: unknown): value is string => typeof value === "string";

function compareStyles(
  node: string,
  before: PageNode["styles"],
  after: PageNode["styles"],
  changes: PageChange[],
): void {
  const from = before as unknown as Record<string, Record<string, unknown> | undefined>;
  const to = after as unknown as Record<string, Record<string, unknown> | undefined>;
  for (const target of keysOf(from, to)) {
    if (target === "owners") {
      const ownersBefore = (from.owners ?? {}) as Record<string, Record<string, unknown>>;
      const ownersAfter = (to.owners ?? {}) as Record<string, Record<string, unknown>>;
      for (const owner of keysOf(ownersBefore, ownersAfter)) {
        compareStyleValues(
          node,
          ["styles", "owners", owner],
          ownersBefore[owner],
          ownersAfter[owner],
          changes,
        );
      }
    } else {
      compareStyleValues(node, ["styles", target], from[target], to[target], changes);
    }
  }
}

function compareStyleValues(
  node: string,
  path: readonly string[],
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
  changes: PageChange[],
): void {
  const from = before ?? {};
  const to = after ?? {};
  for (const name of keysOf(from, to)) {
    if (from[name] !== to[name]) changes.push(setStep(node, [...path, name], to[name]));
  }
}

function setStep(node: string, path: readonly string[], value: unknown): PageChange {
  return value === undefined ? { op: "set", node, path } : { op: "set", node, path, value };
}

function keysOf(first: object, second: object): string[] {
  return [...new Set([...Object.keys(first), ...Object.keys(second)])];
}

/** The page with these steps applied. A step that no longer means anything does nothing. */
export function applyPageChanges(
  document: PageDocument,
  changes: readonly PageChange[],
): PageDocument {
  let root = document.root;
  for (const change of changes) root = applyChange(root, change);
  return root === document.root ? document : { ...document, root };
}

function applyChange(root: PageNode, change: PageChange): PageNode {
  switch (change.op) {
    case "set":
      if (notValues.has(change.path[0] as string)) return root;
      return replaceNode(root, change.node, (node) => setValue(node, change.path, change.value));
    case "text":
      return replaceNode(root, change.node, (node) => changeWords(node, change));
    case "insert":
      if (listNodes(change.node).some((node) => findNode(root, node.id))) return root;
      return placeNode(root, change.node, change.parent, change.after);
    case "move":
      return moveNode(root, change);
    case "remove":
      return change.node === root.id ? root : removeNode(root, change.node);
  }
}

function replaceNode(
  root: PageNode,
  nodeId: string,
  update: (node: PageNode) => PageNode,
): PageNode {
  const path = findPath(root, nodeId);
  const target = path.at(-1);
  if (!target) return root;
  let replaced = update(target);
  if (replaced === target) return root;
  for (let index = path.length - 2; index >= 0; index -= 1) {
    const parent = path[index] as PageNode;
    const child = path[index + 1] as PageNode;
    const finished = replaced;
    replaced = {
      ...parent,
      children: parent.children.map((each) => (each === child ? finished : each)),
    };
  }
  return replaced;
}

function setValue(node: PageNode, path: readonly string[], value: unknown): PageNode {
  const changed = setIn(node as unknown as Record<string, unknown>, path, value);
  const next = changed as unknown as PageNode;
  return path[0] === "props" ? withMarksThatFit(next) : next;
}

function setIn(
  holder: Record<string, unknown>,
  path: readonly string[],
  value: unknown,
): Record<string, unknown> {
  const [key, ...rest] = path as [string, ...string[]];
  if (rest.length === 0) {
    if (value !== undefined) return { ...holder, [key]: value };
    const others = { ...holder };
    delete others[key];
    return others;
  }
  const inner = holder[key];
  const within = typeof inner === "object" && inner !== null ? inner : {};
  return { ...holder, [key]: setIn(within as Record<string, unknown>, rest, value) };
}

function changeWords(node: PageNode, change: Extract<PageChange, { op: "text" }>): PageNode {
  const current = node.props[change.prop];
  const words =
    typeof current === "string" ? mergeText(change.from, change.to, current) : change.to;
  if (words === current) return node;
  const marks = node.props.marks;
  const props = { ...node.props, [change.prop]: words };
  if (change.prop === "text" && typeof current === "string" && Array.isArray(marks)) {
    props.marks = rebaseMarks(current, words, marks as TextMark[]);
  }
  return withMarksThatFit({ ...node, props });
}

/** Styled parts of words are positions in them, so they're kept inside whatever the words became. */
function withMarksThatFit(node: PageNode): PageNode {
  const { marks, text } = node.props;
  if (!Array.isArray(marks) || typeof text !== "string") return node;
  return {
    ...node,
    props: { ...node.props, marks: normaliseMarks(marks as TextMark[], text.length) },
  };
}

function moveNode(root: PageNode, change: Extract<PageChange, { op: "move" }>): PageNode {
  const node = findNode(root, change.node);
  // Into itself can happen when two people move things into each other: the second does nothing.
  if (!node || change.node === root.id || findNode(node, change.parent)) return root;
  if (!findNode(root, change.parent)) return root;
  return placeNode(removeNode(root, change.node), node, change.parent, change.after);
}

function placeNode(
  root: PageNode,
  node: PageNode,
  parentId: string,
  after: string | null,
): PageNode {
  return replaceNode(root, parentId, (parent) => {
    const children = [...parent.children];
    children.splice(placeFor(children, after), 0, node);
    return { ...parent, children };
  });
}

/** The site's navigation stays first and its footer last, whatever is added to the page. */
function placeFor(children: readonly PageNode[], after: string | null): number {
  if (after === null) return children[0]?.id === siteSectionNodeIds.navigation ? 1 : 0;
  const sibling = children.findIndex((child) => child.id === after);
  if (sibling !== -1) return sibling + 1;
  return children.at(-1)?.id === siteSectionNodeIds.footer ? children.length - 1 : children.length;
}

/** Something both sets of steps changed: the element, for saying which it was. */
export interface PageClash {
  nodeId: string;
}

/**
 * Where two people's steps from the same page can't both stand: the same value, words that
 * can't be merged, the same element moved twice, or one person changing what the other removed.
 */
export function findClashes(
  base: PageDocument,
  mine: readonly PageChange[],
  theirs: readonly PageChange[],
): PageClash[] {
  const clashes = new Set<string>();
  const removedByThem = removedElements(base, theirs);
  const removedByMe = removedElements(base, mine);
  for (const change of mine) {
    const touched = touchedElement(change);
    if (touched && removedByThem.has(touched)) clashes.add(touched);
    for (const other of theirs) {
      if (touched && touchedElement(other) === touched && stepsClash(change, other)) {
        clashes.add(touched);
      }
    }
  }
  for (const change of theirs) {
    const touched = touchedElement(change);
    if (touched && removedByMe.has(touched)) clashes.add(touched);
  }
  return [...clashes].map((nodeId) => ({ nodeId }));
}

function touchedElement(change: PageChange): string | null {
  return change.op === "insert" || change.op === "remove" ? null : change.node;
}

function removedElements(base: PageDocument, changes: readonly PageChange[]): Set<string> {
  const removed = new Set<string>();
  for (const change of changes) {
    if (change.op !== "remove") continue;
    const node = findNode(base.root, change.node);
    for (const each of node ? listNodes(node) : []) removed.add(each.id);
  }
  return removed;
}

function stepsClash(first: PageChange, second: PageChange): boolean {
  if (first.op === "move" && second.op === "move") {
    return first.parent !== second.parent || first.after !== second.after;
  }
  if (first.op === "set" && second.op === "set") {
    const shared = Math.min(first.path.length, second.path.length);
    const samePlace =
      first.path.slice(0, shared).join("\n") === second.path.slice(0, shared).join("\n");
    return samePlace && !sameValue(first.value, second.value);
  }
  if (first.op === "text" && second.op === "text") {
    return (
      first.prop === second.prop &&
      first.to !== second.to &&
      mergeText(first.from, first.to, second.to) === first.to
    );
  }
  return false;
}
