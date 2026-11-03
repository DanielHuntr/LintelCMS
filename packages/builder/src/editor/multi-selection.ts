import {
  copyWithNewIds,
  createNode,
  findNode,
  findPlace,
  insertNode,
  type NodeAnimation,
  type NodeStyles,
  type PageNode,
  removeNode,
  retargetAnimations,
  rootNodeId,
  setStyles,
  siteSectionSlotOf,
  type StylePropertyName,
  type StyleTarget,
  updateNode,
} from "@lintel/builder-model";
import { type CommandContext, type CommandResult, isLocked, layerName } from "./commands.js";
import type { PageChange } from "./editor-state.js";

/**
 * Several elements selected at once: Ctrl/Cmd-click or Shift-click in Layers or on the
 * canvas. The first id is the one selected first, which the editor still treats as "the"
 * selection; the rest are along with it. Each change to all of them is one step in Undo.
 */

/** How a click changes the selection: just this one, add or take it away, or a range. */
export type SelectHow = "only" | "toggle" | "range";

/**
 * The selection after a click. A range runs between the first selected and this one when
 * they are side by side in the same parent; otherwise it adds this one.
 */
export function selectionAfterClick(
  root: PageNode,
  current: readonly string[],
  nodeId: string,
  how: SelectHow,
): string[] {
  if (how === "only" || current.length === 0) return [nodeId];
  if (how === "toggle") {
    if (!current.includes(nodeId)) return [...current, nodeId];
    const rest = current.filter((id) => id !== nodeId);
    return rest.length > 0 ? rest : [nodeId];
  }
  const anchor = current[0] as string;
  const anchorPlace = findPlace(root, anchor);
  const place = findPlace(root, nodeId);
  if (!anchorPlace || !place || anchorPlace.parent.id !== place.parent.id) {
    return current.includes(nodeId) ? [...current] : [...current, nodeId];
  }
  const from = Math.min(anchorPlace.index, place.index);
  const to = Math.max(anchorPlace.index, place.index);
  const range = place.parent.children.slice(from, to + 1).map((child) => child.id);
  return [anchor, ...range.filter((id) => id !== anchor)];
}

/** Everything in the same parent as this element (Ctrl/Cmd+A in Layers), it first. */
export function selectSiblings(root: PageNode, nodeId: string): string[] {
  const place = findPlace(root, nodeId);
  if (!place) return [nodeId];
  return [nodeId, ...place.parent.children.map((child) => child.id).filter((id) => id !== nodeId)];
}

/** The next or previous sibling of the last one added, added too (Shift+Arrow in Layers). */
export function extendSelection(
  root: PageNode,
  current: readonly string[],
  direction: "previous" | "next",
): string[] {
  const last = current.at(-1);
  if (!last) return [...current];
  const place = findPlace(root, last);
  const neighbour = place?.parent.children[place.index + (direction === "next" ? 1 : -1)];
  if (!neighbour) return [...current];
  if (current.includes(neighbour.id)) {
    // Going back over the selection takes the last one away again.
    return current.length > 1 ? current.slice(0, -1) : [...current];
  }
  return [...current, neighbour.id];
}

/** The selected ids that are still on the page, in their selection order. */
export function stillThere(root: PageNode, ids: readonly string[]): string[] {
  return ids.filter((id) => id !== rootNodeId && findNode(root, id) !== undefined);
}

const styleTargets = [
  "base",
  "tablet",
  "phone",
  "hover",
  "pressed",
  "focus",
  "open",
  "selected",
] as const;

/**
 * The styles several elements share (a value shows only where every one has the same), and
 * the properties where they differ ("Mixed").
 */
export function sharedLook(nodes: readonly PageNode[]): {
  styles: NodeStyles;
  mixed: ReadonlySet<StylePropertyName>;
} {
  const styles: NodeStyles = { base: {} };
  const mixed = new Set<StylePropertyName>();
  const [first, ...rest] = nodes;
  if (!first) return { styles, mixed };
  for (const target of styleTargets) {
    const properties = new Set<StylePropertyName>();
    for (const node of nodes) {
      for (const property of Object.keys(node.styles[target] ?? {})) {
        properties.add(property as StylePropertyName);
      }
    }
    for (const property of properties) {
      const value = first.styles[target]?.[property];
      if (value !== undefined && rest.every((node) => node.styles[target]?.[property] === value)) {
        styles[target] = { ...styles[target], [property]: value };
      } else {
        mixed.add(property);
      }
    }
  }
  return { styles, mixed };
}

/** The one kind they all are, or null when they're different kinds. */
export function sharedType(nodes: readonly PageNode[]): string | null {
  const [first, ...rest] = nodes;
  return first && rest.every((node) => node.type === first.type) ? first.type : null;
}

function refuseLockedOrMissing(
  context: CommandContext,
  ids: readonly string[],
): CommandResult | null {
  if (ids.length === 0) return { refused: context.text("pageBuilder.refused.nothingSelected") };
  for (const id of ids) {
    const node = findNode(context.document.root, id);
    if (!node) return { refused: context.text("pageBuilder.refused.nothingSelected") };
    if (isLocked(context.document, id)) {
      return {
        refused: context.text("pageBuilder.refused.locked", {
          name: layerName(node, context.catalogue),
        }),
      };
    }
  }
  return null;
}

const updateAll =
  (ids: readonly string[], change: (node: PageNode) => PageNode) =>
  (document: CommandContext["document"]) => ({
    ...document,
    root: ids.reduce((root, id) => updateNode(root, id, change), document.root),
  });

/**
 * The same change made to each element, as one step: each result's update runs on what the
 * one before left. Refused when any of them is.
 */
export function allAsOne(results: readonly CommandResult[], label: string): CommandResult {
  const changes: PageChange[] = [];
  for (const result of results) {
    if ("refused" in result) return result;
    changes.push(result.change);
  }
  return {
    change: {
      label,
      update: (document) => changes.reduce((current, change) => change.update(current), document),
    },
  };
}

/** One style change to every selected element, as one step (typing runs merge, as for one). */
export function changeStylesOfMany(
  context: CommandContext,
  ids: readonly string[],
  target: StyleTarget,
  values: Partial<Record<StylePropertyName, string | undefined>>,
  label: string,
): CommandResult {
  const refused = refuseLockedOrMissing(context, ids);
  if (refused) return refused;
  return {
    change: {
      label: context.text("pageBuilder.history.changedMany", { name: label, count: ids.length }),
      update: updateAll(ids, (node) => ({
        ...node,
        styles: setStyles(node.styles, target, values) as NodeStyles,
      })),
      coalesceKey: `styles-many:${ids.join(",")}:${target}:${Object.keys(values).join(",")}`,
    },
  };
}

/** The same animations on every selected element. */
export function animateMany(
  context: CommandContext,
  ids: readonly string[],
  animations: readonly NodeAnimation[],
): CommandResult {
  const refused = refuseLockedOrMissing(context, ids);
  if (refused) return refused;
  return {
    change: {
      label: context.text("pageBuilder.history.animatedMany", { count: ids.length }),
      update: updateAll(ids, (node) => {
        const next: PageNode = { ...node };
        // What played on the first plays on each one itself.
        const own = new Map([[ids[0] as string, node.id]]);
        const moved = retargetAnimations(
          { ...node, children: [], animations: [...animations] },
          own,
        );
        if (animations.length > 0) next.animations = moved.animations;
        else delete next.animations;
        return next;
      }),
      coalesceKey: `animate-many:${ids.join(",")}`,
    },
  };
}

/** A shared style for every selected element (or, with null, none). */
export function applySharedStyleToMany(
  context: CommandContext,
  ids: readonly string[],
  sharedStyleId: string | null,
): CommandResult {
  const refused = refuseLockedOrMissing(context, ids);
  if (refused) return refused;
  return {
    change: {
      label: context.text("pageBuilder.history.sharedStyleMany", { count: ids.length }),
      update: updateAll(ids, (node) => {
        const next: PageNode = { ...node };
        if (sharedStyleId) next.sharedStyle = sharedStyleId;
        else delete next.sharedStyle;
        return next;
      }),
    },
  };
}

/** Deletes every selected element. The site's navigation and footer can't go this way. */
export function removeMany(context: CommandContext, ids: readonly string[]): CommandResult {
  const refused = refuseLockedOrMissing(context, ids);
  if (refused) return refused;
  if (ids.some((id) => siteSectionSlotOf(id))) {
    return { refused: context.text("pageBuilder.refused.manyWithSiteSection") };
  }
  return {
    change: {
      label: context.text("pageBuilder.history.removedMany", { count: ids.length }),
      update: (document) => ({
        ...document,
        root: ids.reduce(
          (root, id) => (findNode(root, id) ? removeNode(root, id) : root),
          document.root,
        ),
      }),
      select: null,
    },
  };
}

/** Copies every selected element, each straight after itself. */
export function duplicateMany(context: CommandContext, ids: readonly string[]): CommandResult {
  const refused = refuseLockedOrMissing(context, ids);
  if (refused) return refused;
  if (ids.some((id) => siteSectionSlotOf(id))) {
    return { refused: context.text("pageBuilder.refused.manyWithSiteSection") };
  }
  const copies = new Map<string, PageNode>();
  for (const id of ids) {
    const node = findNode(context.document.root, id) as PageNode;
    copies.set(id, copyWithNewIds(node, context.createId));
  }
  return {
    change: {
      label: context.text("pageBuilder.history.duplicatedMany", { count: ids.length }),
      update: (document) => ({
        ...document,
        root: ids.reduce((root, id) => {
          const place = findPlace(root, id);
          const copy = copies.get(id);
          return place && copy ? insertNode(root, place.parent.id, place.index + 1, copy) : root;
        }, document.root),
      }),
    },
  };
}

/** Whether every one is in the same parent, which grouping and moving together need. */
export function sameParent(root: PageNode, ids: readonly string[]): PageNode | null {
  const parents = ids.map((id) => findPlace(root, id)?.parent);
  const first = parents[0];
  return first && parents.every((parent) => parent?.id === first.id) ? first : null;
}

/** Puts the selected elements in a new box where the first of them was, in page order. */
export function groupIntoBox(context: CommandContext, ids: readonly string[]): CommandResult {
  const refused = refuseLockedOrMissing(context, ids);
  if (refused) return refused;
  const parent = sameParent(context.document.root, ids);
  if (!parent || !context.catalogue.canContain(parent.type, "box")) {
    return { refused: context.text("pageBuilder.refused.groupNeedsSameParent") };
  }
  const inOrder = parent.children.filter((child) => ids.includes(child.id));
  const at = parent.children.findIndex((child) => ids.includes(child.id));
  const box = createNode({ type: "box", name: "" }, context.catalogue, context.createId);
  const filled: PageNode = { ...box, children: inOrder };
  return {
    change: {
      label: context.text("pageBuilder.history.groupedMany", { count: ids.length }),
      update: (document) => {
        const without = inOrder.reduce((root, child) => removeNode(root, child.id), document.root);
        return { ...document, root: insertNode(without, parent.id, at, filled) };
      },
      select: filled.id,
    },
  };
}

/** Moves the selected elements up or down one place together, keeping their order. */
export function moveManyTogether(
  context: CommandContext,
  ids: readonly string[],
  direction: "up" | "down",
): CommandResult {
  const refused = refuseLockedOrMissing(context, ids);
  if (refused) return refused;
  const parent = sameParent(context.document.root, ids);
  if (!parent) return { refused: context.text("pageBuilder.refused.groupNeedsSameParent") };
  const children = parent.children;
  const chosen = new Set(ids);
  const indexes = children.flatMap((child, index) => (chosen.has(child.id) ? [index] : []));
  const edge = direction === "up" ? indexes[0] === 0 : indexes.at(-1) === children.length - 1;
  if (edge) return { refused: context.text("pageBuilder.refused.cantMoveFurther") };
  const reordered = [...children];
  const order = direction === "up" ? indexes : [...indexes].reverse();
  for (const index of order) {
    const other = index + (direction === "up" ? -1 : 1);
    [reordered[index], reordered[other]] = [
      reordered[other] as PageNode,
      reordered[index] as PageNode,
    ];
  }
  return {
    change: {
      label: context.text("pageBuilder.history.movedMany", { count: ids.length }),
      update: (document) => ({
        ...document,
        root: updateNode(document.root, parent.id, (node) => ({ ...node, children: reordered })),
      }),
    },
  };
}
