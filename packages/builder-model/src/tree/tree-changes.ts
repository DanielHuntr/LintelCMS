import type { PageNode } from "../document/page-document.schema.js";
import type { CreateNodeId } from "./node-ids.js";
import { findPlace, isInside } from "./tree-queries.js";

/**
 * Changing a page tree. Every function returns a new tree and leaves the old one as it was;
 * nodes off the changed path are shared, not copied. That keeps undo cheap (the history holds
 * whole trees) and lets the editor skip redrawing layers that didn't change.
 */

export class NodeNotFoundError extends Error {
  constructor(nodeId: string) {
    super(`There is no element with the id “${nodeId}” on this page.`);
    this.name = "NodeNotFoundError";
  }
}

export class InvalidMoveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMoveError";
  }
}

/** Replaces one node with what `change` gives back. Throws if the node isn't in the tree. */
export function updateNode(
  root: PageNode,
  nodeId: string,
  change: (node: PageNode) => PageNode,
): PageNode {
  const updated = updateIfFound(root, nodeId, change);
  if (updated === undefined) throw new NodeNotFoundError(nodeId);
  return updated;
}

function updateIfFound(
  node: PageNode,
  nodeId: string,
  change: (node: PageNode) => PageNode,
): PageNode | undefined {
  if (node.id === nodeId) return change(node);
  for (let index = 0; index < node.children.length; index += 1) {
    const child = node.children[index] as PageNode;
    const updatedChild = updateIfFound(child, nodeId, change);
    if (updatedChild !== undefined) {
      const children = node.children.slice();
      children[index] = updatedChild;
      return { ...node, children };
    }
  }
  return undefined;
}

/** Puts `node` inside `parentId` at `index` (clamped to the ends of the list). */
export function insertNode(
  root: PageNode,
  parentId: string,
  index: number,
  node: PageNode,
): PageNode {
  return updateNode(root, parentId, (parent) => {
    const children = parent.children.slice();
    children.splice(clamp(index, 0, children.length), 0, node);
    return { ...parent, children };
  });
}

export function removeNode(root: PageNode, nodeId: string): PageNode {
  const place = findPlace(root, nodeId);
  if (!place) throw new NodeNotFoundError(nodeId);
  return updateNode(root, place.parent.id, (parent) => ({
    ...parent,
    children: parent.children.filter((child) => child.id !== nodeId),
  }));
}

/**
 * Moves a node to `index` inside `parentId`. `index` counts the new parent's children as
 * they are before the move, so "put it before the third child" means index 2 either way.
 */
export function moveNode(
  root: PageNode,
  nodeId: string,
  parentId: string,
  index: number,
): PageNode {
  const place = findPlace(root, nodeId);
  if (!place) throw new NodeNotFoundError(nodeId);
  if (isInside(root, parentId, nodeId)) {
    throw new InvalidMoveError("An element can’t go inside itself.");
  }
  const node = place.parent.children[place.index] as PageNode;
  const sameParent = place.parent.id === parentId;
  const target = sameParent && place.index < index ? index - 1 : index;
  return insertNode(removeNode(root, nodeId), parentId, target, node);
}

/**
 * A copy of a node and everything inside it, with new ids throughout. An animation that
 * plays on elements inside the copy is pointed at the copied elements; it used to keep
 * playing on the original's (LINTEL-FUNC-021). Targets outside the copy are kept.
 */
export function copyWithNewIds(node: PageNode, createId: CreateNodeId): PageNode {
  const newIds = new Map<string, string>();
  const copy = copyIds(node, createId, newIds);
  return retargetAnimations(copy, newIds);
}

function copyIds(node: PageNode, createId: CreateNodeId, newIds: Map<string, string>): PageNode {
  const id = createId();
  newIds.set(node.id, id);
  return {
    ...node,
    id,
    children: node.children.map((child) => copyIds(child, createId, newIds)),
  };
}

function retargetAnimations(node: PageNode, newIds: ReadonlyMap<string, string>): PageNode {
  const children = node.children.map((child) => retargetAnimations(child, newIds));
  node = retargetOwnerStates(node, newIds);
  if (!node.animations) return { ...node, children };
  const animations = node.animations.map((animation) => {
    const targets = animation.spec.targets;
    const trigger = animation.spec.trigger;
    let spec = animation.spec;
    if (targets.type === "nodes") {
      spec = {
        ...spec,
        targets: { ...targets, nodeIds: targets.nodeIds.map((id) => newIds.get(id) ?? id) },
      };
    }
    // A scene step inside the copy follows the copied section, too.
    if (trigger.type === "scroll" && trigger.follows && newIds.has(trigger.follows)) {
      spec = { ...spec, trigger: { ...trigger, follows: newIds.get(trigger.follows) } };
    }
    return { ...animation, spec };
  });
  return { ...node, children, animations };
}

/** Puts a copy straight after the original and gives back the copy's id. */
export function duplicateNode(
  root: PageNode,
  nodeId: string,
  createId: CreateNodeId,
): { root: PageNode; copyId: string } {
  const place = findPlace(root, nodeId);
  if (!place) throw new NodeNotFoundError(nodeId);
  const copy = copyWithNewIds(place.parent.children[place.index] as PageNode, createId);
  return { root: insertNode(root, place.parent.id, place.index + 1, copy), copyId: copy.id };
}

function clamp(value: number, lowest: number, highest: number): number {
  return Math.min(Math.max(value, lowest), highest);
}

/**
 * Styles that follow an owner's state ("while the card is hovered") follow the copied owner
 * when both are copied, so a copied card's picture grows with the copy, not the original.
 */
function retargetOwnerStates(node: PageNode, newIds: ReadonlyMap<string, string>): PageNode {
  const owners = node.styles.owners;
  if (!owners) return node;
  const moved = Object.fromEntries(
    Object.entries(owners).map(([target, declarations]) => {
      const [state, ownerId = ""] = target.split("@");
      return [`${state}@${newIds.get(ownerId) ?? ownerId}`, declarations];
    }),
  );
  return { ...node, styles: { ...node.styles, owners: moved } };
}
