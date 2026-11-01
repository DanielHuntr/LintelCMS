import type { PageNode } from "../document/page-document.schema.js";

/**
 * Reading a page tree: finding nodes, their ancestors and their place among siblings.
 * Nothing here changes a tree; see tree-changes.ts for that.
 */

/** Visits every node, parents before children, in the order they appear on the page. */
export function walkNodes(
  root: PageNode,
  visit: (node: PageNode, parent: PageNode | null, depth: number) => void,
): void {
  const stack: Array<{ node: PageNode; parent: PageNode | null; depth: number }> = [
    { node: root, parent: null, depth: 0 },
  ];
  while (stack.length > 0) {
    const { node, parent, depth } = stack.pop() as {
      node: PageNode;
      parent: PageNode | null;
      depth: number;
    };
    visit(node, parent, depth);
    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      stack.push({ node: node.children[index] as PageNode, parent: node, depth: depth + 1 });
    }
  }
}

/** Every node in page order, the root first. */
export function listNodes(root: PageNode): PageNode[] {
  const nodes: PageNode[] = [];
  walkNodes(root, (node) => nodes.push(node));
  return nodes;
}

export function countNodes(root: PageNode): number {
  let count = 0;
  walkNodes(root, () => {
    count += 1;
  });
  return count;
}

/** The node and its ancestors, from the root down to it; empty if it isn't in the tree. */
export function findPath(root: PageNode, nodeId: string): PageNode[] {
  if (root.id === nodeId) return [root];
  for (const child of root.children) {
    const path = findPath(child, nodeId);
    if (path.length > 0) return [root, ...path];
  }
  return [];
}

export function findNode(root: PageNode, nodeId: string): PageNode | undefined {
  let found: PageNode | undefined;
  walkNodes(root, (node) => {
    if (!found && node.id === nodeId) found = node;
  });
  return found;
}

export interface NodePlace {
  parent: PageNode;
  index: number;
}

/** The node's parent and its position among the parent's children. Undefined for the root. */
export function findPlace(root: PageNode, nodeId: string): NodePlace | undefined {
  const path = findPath(root, nodeId);
  const parent = path.at(-2);
  if (!parent) return undefined;
  return { parent, index: parent.children.findIndex((child) => child.id === nodeId) };
}

/** Whether `nodeId` is `ancestorId` or somewhere inside it. */
export function isInside(root: PageNode, nodeId: string, ancestorId: string): boolean {
  return findPath(root, nodeId).some((node) => node.id === ancestorId);
}

/** How deep the tree goes: 1 for a root on its own. */
export function treeDepth(root: PageNode): number {
  let deepest = 0;
  walkNodes(root, (_node, _parent, depth) => {
    deepest = Math.max(deepest, depth + 1);
  });
  return deepest;
}

/**
 * The rows of the Layers panel: every node under the root in reading order, with its depth,
 * leaving out those inside a collapsed node. The arrow keys move through this list.
 */
export function listVisibleRows(
  root: PageNode,
  collapsed: ReadonlySet<string>,
): Array<{ node: PageNode; depth: number }> {
  const rows: Array<{ node: PageNode; depth: number }> = [];
  const add = (node: PageNode, depth: number) => {
    rows.push({ node, depth });
    if (collapsed.has(node.id)) return;
    for (const child of node.children) add(child, depth + 1);
  };
  for (const child of root.children) add(child, 0);
  return rows;
}
