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
  type NodeAnimation,
  pageEdgeFor,
  type NodeEffect,
  type StateTransition,
  type NodeBlueprint,
  type NodeStyles,
  type PageDocument,
  type PageNode,
  rebaseMarks,
  removeNode,
  rootNodeId,
  setStyles,
  siteSectionSlotOf,
  type StylePropertyName,
  type StyleTarget,
  type TextMark,
  updateNode,
} from "@lintel/builder-model";
import type { Translate } from "../i18n/builder-text.js";
import type { PageChange } from "./editor-state.js";
import { setSiteSectionHidden } from "./site-section-commands.js";

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

/** The last place for something on the page: the site's footer stays below everything. */
function endOfPage(root: PageNode): number {
  const footer = root.children.findIndex((child) => siteSectionSlotOf(child.id) === "footer");
  return footer === -1 ? root.children.length : footer;
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
  return findPlaceAfter(context, selected, type);
}

/** The nearest place after this element that can hold the type, or the end of the page. */
export function findPlaceAfter(
  context: CommandContext,
  selected: PageNode | undefined,
  type: string,
): { parentId: string; index: number } | null {
  const { document, catalogue } = context;
  for (
    let path = selected ? findPath(document.root, selected.id) : [];
    path.length > 1;
    path = path.slice(0, -1)
  ) {
    const child = path.at(-1) as PageNode;
    const parent = path.at(-2) as PageNode;
    if (catalogue.canContain(parent.type, type) && !isLocked(document, parent.id)) {
      const after = parent.children.indexOf(child) + 1;
      return {
        parentId: parent.id,
        index: parent.id === rootNodeId ? Math.min(after, endOfPage(parent)) : after,
      };
    }
  }
  return catalogue.canContain("page", type)
    ? { parentId: rootNodeId, index: endOfPage(document.root) }
    : null;
}

/**
 * Where a ready-made section goes: on the page itself, after the section holding what's
 * selected. Inside a column it would be squashed, and a section just added is still selected.
 */
function findSectionPlace(context: CommandContext): { parentId: string; index: number } | null {
  const { document, selectedId } = context;
  if (isLocked(document, rootNodeId)) return null;
  const top = selectedId ? findPath(document.root, selectedId)[1] : undefined;
  const end = endOfPage(document.root);
  return {
    parentId: rootNodeId,
    index: top ? Math.min(document.root.children.indexOf(top) + 1, end) : end,
  };
}

/** Adds a section from the Sections list, whatever is selected. */
export function insertSectionTemplate(
  context: CommandContext,
  blueprint: NodeBlueprint,
): CommandResult {
  const place = findEdgePlace(context, blueprint) ?? findSectionPlace(context);
  if (!place) return insertBlueprint(context, blueprint);
  const node = createNode(blueprint, context.catalogue, context.createId);
  return placeNodes(
    context,
    [node],
    place,
    context.text("pageBuilder.history.added", { name: layerName(node, context.catalogue) }),
  );
}

export function insertBlueprint(context: CommandContext, blueprint: NodeBlueprint): CommandResult {
  const place = findEdgePlace(context, blueprint) ?? findInsertPlace(context, blueprint.type);
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

/**
 * A header goes at the very top of the page and a footer at the very bottom, whatever is
 * selected (see `pageEdgeFor`). Null for anything else, or when the page itself is locked.
 */
function findEdgePlace(
  context: CommandContext,
  blueprint: NodeBlueprint,
): { parentId: string; index: number } | null {
  const edge = pageEdgeFor(blueprint);
  const { document, catalogue } = context;
  if (!edge || !catalogue.canContain("page", blueprint.type) || isLocked(document, rootNodeId)) {
    return null;
  }
  return { parentId: rootNodeId, index: edge === "top" ? 0 : document.root.children.length };
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
export function placeNodes(
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

/** A Menu link belongs to its Menu: it moves, copies and goes with it, never on its own. */
function partOfMenu(context: Pick<CommandContext, "text">, node: PageNode): CommandResult | null {
  return node.type === "menuLink" ? { refused: context.text("pageBuilder.menu.partOfMenu") } : null;
}

export function removeSelected(context: CommandContext): CommandResult {
  const node = selectedNode(context);
  if ("refused" in node) return node;
  const fixed = partOfMenu(context, node);
  if (fixed) return fixed;
  // The site's navigation and footer are on every page: deleting one here hides it here.
  const slot = siteSectionSlotOf(node.id);
  if (slot) return setSiteSectionHidden(context, slot, true);
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
  const fixed = partOfMenu(context, node);
  if (fixed) return fixed;
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
  const fixed = partOfMenu(context, node);
  if (fixed) return fixed;
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
  const fixed = partOfMenu(context, node);
  if (fixed) return fixed;
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
    (node) => ({ ...node, props: withMovedMarks(node.props, props) }),
    { coalesceKey: `props:${nodeId}:${Object.keys(props).join(",")}` },
  );
}

/** When a text with styled parts is edited, the styles move with the words they were on. */
function withMovedMarks(
  current: Record<string, unknown>,
  changes: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...current, ...changes };
  const marks = current.marks;
  if (
    !Array.isArray(marks) ||
    marks.length === 0 ||
    "marks" in changes ||
    typeof changes.text !== "string" ||
    typeof current.text !== "string"
  ) {
    return next;
  }
  const moved = rebaseMarks(current.text, changes.text, marks as TextMark[]);
  if (moved.length > 0) return { ...next, marks: moved };
  delete next.marks;
  return next;
}

/** Shows a field of the current entry in a prop, or (with `null`) types it in again. */
export function changeBinding(
  context: CommandContext,
  nodeId: string,
  prop: string,
  fieldPath: string | null,
  propLabel: string,
): CommandResult {
  return changeNode(
    context,
    nodeId,
    context.text("pageBuilder.history.changed", { name: propLabel }),
    (node) => {
      const bindings = { ...node.bindings };
      if (fieldPath) bindings[prop] = fieldPath;
      else delete bindings[prop];
      const changed: PageNode = { ...node, bindings };
      if (Object.keys(bindings).length === 0) delete changed.bindings;
      return changed;
    },
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

/**
 * Puts each replacement where its element is, as one change (one Undo), as making several
 * similar elements one component does. Refused when any of them is locked.
 */
export function replaceNodes(
  context: CommandContext,
  replacements: ReadonlyArray<{ nodeId: string; node: PageNode }>,
  label: string,
): CommandResult {
  for (const { nodeId } of replacements) {
    const node = findNode(context.document.root, nodeId);
    if (!node) return { refused: context.text("pageBuilder.refused.nothingSelected") };
    if (isLocked(context.document, nodeId)) {
      return {
        refused: context.text("pageBuilder.refused.locked", {
          name: layerName(node, context.catalogue),
        }),
      };
    }
  }
  return {
    change: {
      label,
      update: withRoot((root) =>
        replacements.reduce((current, { nodeId, node }) => {
          const place = findPlace(current, nodeId);
          if (!place) return current;
          return insertNode(removeNode(current, nodeId), place.parent.id, place.index, node);
        }, root),
      ),
      select: replacements[0]?.node.id ?? null,
    },
  };
}

/** Gives an element an animation, changes it, or (with null) takes it away. */
export function changeAnimations(
  context: CommandContext,
  nodeId: string,
  animations: NodeAnimation[],
): CommandResult {
  const node = findNode(context.document.root, nodeId);
  if (!node) return { refused: context.text("pageBuilder.refused.nothingSelected") };
  const name = layerName(node, context.catalogue);
  const removed = animations.length < (node.animations?.length ?? 0);
  return changeNode(
    context,
    nodeId,
    context.text(
      removed ? "pageBuilder.history.removedAnimation" : "pageBuilder.history.animated",
      { name },
    ),
    ({ animations: _previous, ...rest }) =>
      animations.length > 0 ? { ...rest, animations } : rest,
    // Edits to the same list run together for undo; adding or removing one is its own step.
    removed || animations.length !== (node.animations?.length ?? 0)
      ? {}
      : { coalesceKey: `animations:${nodeId}` },
  );
}

/** Sets an element's effects from the Effects library; an empty list takes them all away. */
export function changeEffects(
  context: CommandContext,
  nodeId: string,
  effects: NodeEffect[],
): CommandResult {
  const node = findNode(context.document.root, nodeId);
  if (!node) return { refused: context.text("pageBuilder.refused.nothingSelected") };
  const name = layerName(node, context.catalogue);
  return changeNode(
    context,
    nodeId,
    context.text("pageBuilder.history.changedEffects", { name }),
    ({ effects: _previous, ...rest }) => (effects.length > 0 ? { ...rest, effects } : rest),
    { coalesceKey: `effects:${nodeId}` },
  );
}

/** Sets how an element, and what follows its states, moves between states; null for no easing. */
export function changeStateTransition(
  context: CommandContext,
  nodeId: string,
  transition: StateTransition | null,
): CommandResult {
  const node = findNode(context.document.root, nodeId);
  if (!node) return { refused: context.text("pageBuilder.refused.nothingSelected") };
  const name = layerName(node, context.catalogue);
  return changeNode(
    context,
    nodeId,
    context.text("pageBuilder.history.changedStateTransition", { name }),
    ({ stateTransition: _previous, ...rest }) =>
      transition ? { ...rest, stateTransition: transition } : rest,
    { coalesceKey: `stateTransition:${nodeId}` },
  );
}

/** Swaps everything on the page for what's on another page, as starting from a template does. */
export function replacePageContent(
  context: CommandContext,
  page: PageDocument,
  label: string,
): CommandResult {
  return {
    change: {
      label,
      // The site's navigation and footer stay where they are, around the new content.
      update: (document) => {
        const shared = document.root.children.filter((child) => siteSectionSlotOf(child.id));
        const first = shared.filter((child) => siteSectionSlotOf(child.id) === "navigation");
        const last = shared.filter((child) => siteSectionSlotOf(child.id) === "footer");
        return {
          ...document,
          root: { ...document.root, children: [...first, ...page.root.children, ...last] },
        };
      },
      select: null,
    },
  };
}
