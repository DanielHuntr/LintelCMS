import {
  type ComponentCatalogue,
  copyWithNewIds,
  type CreateNodeId,
  createNode,
  duplicateNode,
  findNode,
  findPath,
  findPlace,
  insertNode,
  moveNode,
  type NodeBlueprint,
  type NodeStyles,
  type PageDocument,
  type PageNode,
  removeNode,
  rootNodeId,
  setStyles,
  type StylePropertyName,
  type StyleTarget,
  updateNode,
} from "@lintel/builder-model";
import type { Translate } from "../i18n/builder-text.js";
import type { PageChange } from "./editor-state.js";

/**
 * Everything the builder can do to a page, as changes for the editor's history. Each one
 * checks it is allowed (locked elements stay put; elements only go where they may) and
 * gives back either the change or a plain reason it can't happen, which the editor announces.
 */

export interface CommandContext {
  document: PageDocument;
  selectedId: string | null;
  catalogue: ComponentCatalogue;
  createId: CreateNodeId;
  text: Translate;
}

export type CommandResult = { change: PageChange } | { refused: string };

const withRoot = (update: (root: PageNode) => PageNode) => (document: PageDocument) => ({
  ...document,
  root: update(document.root),
});

export function layerName(node: PageNode, catalogue: ComponentCatalogue): string {
  return node.name || catalogue.find(node.type)?.label || node.type;
}

/** Whether the node, or anything it sits in, is locked. */
export function isLocked(document: PageDocument, nodeId: string): boolean {
  return findPath(document.root, nodeId).some((node) => node.locked);
}

/**
 * Where something new goes: inside the selected element when it can hold it (at the end),
 * otherwise straight after the selected element, otherwise at the end of the page.
 */
export function findInsertPlace(
  context: CommandContext,
  type: string,
): { parentId: string; index: number } | null {
  const { document, selectedId, catalogue } = context;
  const selected = selectedId ? findNode(document.root, selectedId) : undefined;
  if (selected && catalogue.canContain(selected.type, type) && !isLocked(document, selected.id)) {
    return { parentId: selected.id, index: selected.children.length };
  }
  for (
    let path = selected ? findPath(document.root, selected.id) : [];
    path.length > 1;
    path = path.slice(0, -1)
  ) {
    const child = path.at(-1) as PageNode;
    const parent = path.at(-2) as PageNode;
    if (catalogue.canContain(parent.type, type) && !isLocked(document, parent.id)) {
      return { parentId: parent.id, index: parent.children.indexOf(child) + 1 };
    }
  }
  return catalogue.canContain("page", type)
    ? { parentId: rootNodeId, index: document.root.children.length }
    : null;
}

export function insertBlueprint(context: CommandContext, blueprint: NodeBlueprint): CommandResult {
  const place = findInsertPlace(context, blueprint.type);
  const definition = context.catalogue.find(blueprint.type);
  if (!place || !definition) {
    return {
      refused: context.text("pageBuilder.refused.noRoom", {
        name: definition?.label ?? blueprint.type,
      }),
    };
  }
  const node = createNode(blueprint, context.catalogue, context.createId);
  return placeNodes(
    context,
    [node],
    place,
    context.text("pageBuilder.history.added", { name: layerName(node, context.catalogue) }),
  );
}

/** Puts ready-made nodes (pasted, imported) at a place, with fresh ids. */
export function insertNodes(
  context: CommandContext,
  nodes: readonly PageNode[],
  place: { parentId: string; index: number },
  label: string,
): CommandResult {
  return placeNodes(
    context,
    nodes.map((node) => copyWithNewIds(node, context.createId)),
    place,
    label,
  );
}

/** Puts nodes that already have their own ids at a place. */
function placeNodes(
  context: CommandContext,
  fresh: readonly PageNode[],
  place: { parentId: string; index: number },
  label: string,
): CommandResult {
  const nodes = fresh;
  const parent = findNode(context.document.root, place.parentId);
  if (!parent || nodes.length === 0)
    return { refused: context.text("pageBuilder.refused.nothingToPaste") };
  const refused = nodes.find((node) => !context.catalogue.canContain(parent.type, node.type));
  if (refused) {
    return {
      refused: context.text("pageBuilder.refused.cantGoInside", {
        name: layerName(refused, context.catalogue),
        parent: layerName(parent, context.catalogue),
      }),
    };
  }
  return {
    change: {
      label,
      update: withRoot((root) =>
        fresh.reduce(
          (tree, node, offset) => insertNode(tree, place.parentId, place.index + offset, node),
          root,
        ),
      ),
      select: fresh[0]?.id ?? null,
    },
  };
}

function selectedNode(context: CommandContext): PageNode | { refused: string } {
  const node = context.selectedId ? findNode(context.document.root, context.selectedId) : undefined;
  if (!node || node.id === rootNodeId)
    return { refused: context.text("pageBuilder.refused.nothingSelected") };
  if (isLocked(context.document, node.id)) {
    return {
      refused: context.text("pageBuilder.refused.locked", {
        name: layerName(node, context.catalogue),
      }),
    };
  }
  return node;
}

export function removeSelected(context: CommandContext): CommandResult {
  const node = selectedNode(context);
  if ("refused" in node) return node;
  const place = findPlace(context.document.root, node.id);
  const neighbour =
    place?.parent.children[place.index + 1] ??
    place?.parent.children[place.index - 1] ??
    place?.parent;
  return {
    change: {
      label: context.text("pageBuilder.history.removed", {
        name: layerName(node, context.catalogue),
      }),
      update: withRoot((root) => removeNode(root, node.id)),
      select: neighbour && neighbour.id !== rootNodeId ? neighbour.id : null,
    },
  };
}

export function duplicateSelected(context: CommandContext): CommandResult {
  const node = selectedNode(context);
  if ("refused" in node) return node;
  const duplicated = duplicateNode(context.document.root, node.id, context.createId);
  return {
    change: {
      label: context.text("pageBuilder.history.duplicated", {
        name: layerName(node, context.catalogue),
      }),
      update: (document) => ({ ...document, root: duplicated.root }),
      select: duplicated.copyId,
    },
  };
}

export type MoveDirection = "up" | "down" | "in" | "out";

/**
 * Moves the selected element: up or down among its siblings, in (into the end of the
 * element above it, when that can hold it) or out (to just after its parent).
 */
export function moveSelected(context: CommandContext, direction: MoveDirection): CommandResult {
  const node = selectedNode(context);
  if ("refused" in node) return node;
  const place = findPlace(context.document.root, node.id);
  if (!place) return { refused: context.text("pageBuilder.refused.nothingSelected") };
  const target = moveTarget(context, node, place, direction);
  if (!target)
    return {
      refused: context.text("pageBuilder.refused.cantMove", {
        name: layerName(node, context.catalogue),
      }),
    };
  return moveTo(context, node.id, target.parentId, target.index);
}

function moveTarget(
  context: CommandContext,
  node: PageNode,
  place: { parent: PageNode; index: number },
  direction: MoveDirection,
): { parentId: string; index: number } | null {
  const { catalogue, document } = context;
  const siblings = place.parent.children;
  if (direction === "up")
    return place.index > 0 ? { parentId: place.parent.id, index: place.index - 1 } : null;
  if (direction === "down") {
    return place.index < siblings.length - 1
      ? { parentId: place.parent.id, index: place.index + 2 }
      : null;
  }
  if (direction === "in") {
    const above = siblings[place.index - 1];
    return above && catalogue.canContain(above.type, node.type) && !isLocked(document, above.id)
      ? { parentId: above.id, index: above.children.length }
      : null;
  }
  const grandparent = findPlace(document.root, place.parent.id);
  return grandparent && catalogue.canContain(grandparent.parent.type, node.type)
    ? { parentId: grandparent.parent.id, index: grandparent.index + 1 }
    : null;
}

/** Moves an element to `index` of `parentId` (counted before the move), as dragging does. */
export function moveTo(
  context: CommandContext,
  nodeId: string,
  parentId: string,
  index: number,
): CommandResult {
  const { document, catalogue, text } = context;
  const node = findNode(document.root, nodeId);
  const parent = findNode(document.root, parentId);
  if (!node || !parent) return { refused: text("pageBuilder.refused.nothingSelected") };
  if (isLocked(document, nodeId) || isLocked(document, parentId)) {
    return { refused: text("pageBuilder.refused.locked", { name: layerName(node, catalogue) }) };
  }
  if (findPath(document.root, parentId).some((ancestor) => ancestor.id === nodeId)) {
    return { refused: text("pageBuilder.refused.insideItself") };
  }
  if (!catalogue.canContain(parent.type, node.type)) {
    return {
      refused: text("pageBuilder.refused.cantGoInside", {
        name: layerName(node, catalogue),
        parent: layerName(parent, catalogue),
      }),
    };
  }
  return {
    change: {
      label: text("pageBuilder.history.moved", { name: layerName(node, catalogue) }),
      update: withRoot((root) => moveNode(root, nodeId, parentId, index)),
      select: nodeId,
    },
  };
}

/** Changes one element: its props, name, hidden or locked. Locked elements only unlock. */
export function changeNode(
  context: CommandContext,
  nodeId: string,
  label: string,
  update: (node: PageNode) => PageNode,
  options: { coalesceKey?: string; evenIfLocked?: boolean } = {},
): CommandResult {
  const node = findNode(context.document.root, nodeId);
  if (!node) return { refused: context.text("pageBuilder.refused.nothingSelected") };
  if (!options.evenIfLocked && isLocked(context.document, nodeId)) {
    return {
      refused: context.text("pageBuilder.refused.locked", {
        name: layerName(node, context.catalogue),
      }),
    };
  }
  return {
    change: {
      label,
      update: withRoot((root) => updateNode(root, nodeId, update)),
      coalesceKey: options.coalesceKey,
    },
  };
}

export function changeProps(
  context: CommandContext,
  nodeId: string,
  props: Record<string, unknown>,
  propLabel: string,
): CommandResult {
  return changeNode(
    context,
    nodeId,
    context.text("pageBuilder.history.changed", { name: propLabel }),
    (node) => ({ ...node, props: { ...node.props, ...props } }),
    { coalesceKey: `props:${nodeId}:${Object.keys(props).join(",")}` },
  );
}

export function changeStyles(
  context: CommandContext,
  nodeId: string,
  target: StyleTarget,
  values: Partial<Record<StylePropertyName, string | undefined>>,
  styleLabel: string,
): CommandResult {
  return changeNode(
    context,
    nodeId,
    context.text("pageBuilder.history.changed", { name: styleLabel }),
    (node) => ({ ...node, styles: setStyles(node.styles, target, values) as NodeStyles }),
    { coalesceKey: `styles:${nodeId}:${target}:${Object.keys(values).join(",")}` },
  );
}

/** Puts `replacement` where the node is, as "Convert to code" does. */
export function replaceNode(
  context: CommandContext,
  nodeId: string,
  replacement: PageNode,
  label: string,
): CommandResult {
  const place = findPlace(context.document.root, nodeId);
  const node = findNode(context.document.root, nodeId);
  if (!place || !node) return { refused: context.text("pageBuilder.refused.nothingSelected") };
  if (isLocked(context.document, nodeId)) {
    return {
      refused: context.text("pageBuilder.refused.locked", {
        name: layerName(node, context.catalogue),
      }),
    };
  }
  return {
    change: {
      label,
      update: withRoot((root) =>
        insertNode(removeNode(root, nodeId), place.parent.id, place.index, replacement),
      ),
      select: replacement.id,
    },
  };
}
