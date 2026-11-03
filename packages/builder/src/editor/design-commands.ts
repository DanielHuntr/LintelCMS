import {
  type DesignVariable,
  detachSharedStyle,
  inlineVariableOnPage,
  giveSharedStyle,
  makeSharedStyle,
  type SharedStyle,
  type Breakpoint,
  breakpoints,
  clampGridPlace,
  type GridPlace,
  gridPlaceStyles,
  type NodeStyles,
  type PlacedGrid,
  readGridLine,
  type StylePropertyName,
  applyMark,
  type BackgroundVideo,
  clearMarks,
  type FreeLayout,
  freeLayoutStartHeight,
  type FreePlace,
  freePlaceStyles,
  findPath,
  type MarkChange,
  type PageFont,
  type PageNode,
  rootNodeId,
  setStyles,
  type StackingMove,
  type StyleTarget,
  type TextMark,
  restack,
} from "@lintel/builder-model";
import { changeNode, type CommandContext, type CommandResult, layerName } from "./commands.js";

/**
 * The builder's design changes beyond single styles: free layouts and where things sit in
 * them, stacking, background videos, the page's fonts and styles on part of a text. Each is
 * one step in the history, with a plain label.
 */

/**
 * Turns a section's free layout on or off. Turning it on gives the section room (if it has
 * no height of its own) and fans out children that have no place yet, so none hide
 * behind another; turning it off takes the places away, leaving everything else.
 */
export function setFreeLayout(
  context: CommandContext,
  nodeId: string,
  freeLayout: FreeLayout | null,
): CommandResult {
  const label = context.text(
    freeLayout
      ? "pageBuilder.design.history.freeLayoutOn"
      : "pageBuilder.design.history.freeLayoutOff",
  );
  return changeNode(context, nodeId, label, (current) => {
    // A container has a free layout or a placed grid, not both.
    const node = freeLayout && current.placedGrid ? withoutPlacedGrid(current, context) : current;
    if (!freeLayout) {
      const rest: PageNode = { ...node };
      delete rest.freeLayout;
      return {
        ...rest,
        children: node.children.map((child) => ({
          ...child,
          styles: setStyles(child.styles, "base", { left: undefined, top: undefined }),
        })),
      };
    }
    const styles =
      node.freeLayout || node.styles.base.minHeight
        ? node.styles
        : setStyles(node.styles, "base", { minHeight: freeLayoutStartHeight });
    let unplaced = 0;
    const children = node.children.map((child) => {
      if (child.styles.base.left !== undefined || child.styles.base.top !== undefined) return child;
      const place = { left: 6 + unplaced * 8, top: 8 + unplaced * 12 };
      unplaced += 1;
      return { ...child, styles: setStyles(child.styles, "base", freePlaceStyles(place)) };
    });
    return { ...node, freeLayout, styles, children };
  });
}

/** The layout styles a placed grid replaces, taken off its container when it is switched on. */
const flowLayoutProperties: readonly StylePropertyName[] = [
  "display",
  "flexDirection",
  "flexWrap",
  "justifyContent",
  "alignItems",
  "gridTemplateColumns",
  "gridTemplateRows",
  "gridTemplateAreas",
];

/** The places on a grid each element has, at every screen size. */
const placeProperties: readonly StylePropertyName[] = ["gridColumn", "gridRow"];

function clearAtEverySize(
  styles: NodeStyles,
  properties: readonly StylePropertyName[],
): NodeStyles {
  const cleared = Object.fromEntries(properties.map((property) => [property, undefined]));
  return breakpoints.reduce((next, breakpoint) => setStyles(next, breakpoint, cleared), styles);
}

/**
 * Turns a section's placed grid on, changes it, or turns it off. Turning it on takes away
 * the container's own flow (a stack or a row) and any free layout; elements without a place
 * take the whole width until they're dragged somewhere. Fewer columns pull places back onto
 * the grid. Turning it off takes the places away and gives the container its usual layout.
 */
export function setPlacedGrid(
  context: CommandContext,
  nodeId: string,
  placedGrid: PlacedGrid | null,
): CommandResult {
  const label = context.text(
    placedGrid ? "pageBuilder.grid.history.on" : "pageBuilder.grid.history.off",
  );
  return changeNode(context, nodeId, label, (node) => {
    if (!placedGrid) return withoutPlacedGrid(node, context);
    let next: PageNode = node;
    if (node.freeLayout) {
      next = { ...node };
      delete next.freeLayout;
      next.children = node.children.map((child) => ({
        ...child,
        styles: setStyles(child.styles, "base", { left: undefined, top: undefined }),
      }));
    }
    const styles = node.placedGrid
      ? next.styles
      : clearAtEverySize(next.styles, flowLayoutProperties);
    const children = next.children.map((child) => ({
      ...child,
      styles: clampPlaces(child.styles, placedGrid.columns),
    }));
    return { ...next, placedGrid: { ...placedGrid }, styles, children };
  });
}

/** Places that would spill past the last column, pulled back onto a grid of `columns`. */
function clampPlaces(styles: NodeStyles, columns: number): NodeStyles {
  let next = styles;
  for (const breakpoint of breakpoints) {
    const line = readGridLine(styles[breakpoint]?.gridColumn);
    if (!line || line.start + line.span - 1 <= columns) continue;
    const place = clampGridPlace(
      { column: line.start, columnSpan: line.span, row: 1, rowSpan: 1 },
      columns,
    );
    next = setStyles(next, breakpoint, {
      gridColumn: gridPlaceStyles(place).gridColumn,
    });
  }
  return next;
}

function withoutPlacedGrid(node: PageNode, context: CommandContext): PageNode {
  if (!node.placedGrid) return node;
  const rest: PageNode = { ...node };
  delete rest.placedGrid;
  // Back to the element's usual layout (a box stacks its contents, for example).
  const usual = context.catalogue.find(node.type)?.defaultStyles?.base ?? {};
  const restored = Object.fromEntries(
    flowLayoutProperties.flatMap((property) =>
      usual[property] !== undefined && node.styles.base[property] === undefined
        ? [[property, usual[property]]]
        : [],
    ),
  );
  return {
    ...rest,
    styles: setStyles(node.styles, "base", restored),
    children: node.children.map((child) => ({
      ...child,
      styles: clearAtEverySize(child.styles, placeProperties),
    })),
  };
}

/**
 * Puts an element on its placed grid, at one screen size: from dragging, resizing, nudging
 * or the style panel. Kept on the grid, so it never spills past the last column.
 */
export function placeOnGrid(
  context: CommandContext,
  nodeId: string,
  target: Breakpoint,
  place: GridPlace,
  label: string,
): CommandResult {
  const parent = findPath(context.document.root, nodeId).at(-2);
  const columns = parent?.placedGrid?.columns;
  if (!columns) return { refused: context.text("pageBuilder.grid.notOnGrid") };
  return changeNode(
    context,
    nodeId,
    label,
    (node) => ({
      ...node,
      styles: setStyles(node.styles, target, gridPlaceStyles(clampGridPlace(place, columns))),
    }),
    { coalesceKey: `grid:${nodeId}:${target}` },
  );
}

/**
 * Shared styles on an element: "make" moves its look into a new shared style (which the app
 * adds to the site), "use" gives it an existing one in place of its own look, and "detach"
 * gives it the shared look as its own again. Its place on a grid or in a free layout stays.
 */
export type SharedStyleChange =
  | { kind: "make"; id: string; name: string }
  | { kind: "use"; id: string; name: string }
  | { kind: "detach"; sharedStyle: SharedStyle | undefined };

export function changeSharedStyle(
  context: CommandContext,
  nodeId: string,
  change: SharedStyleChange,
): CommandResult {
  const label =
    change.kind === "detach"
      ? context.text("pageBuilder.shared.history.detached")
      : context.text(
          change.kind === "make"
            ? "pageBuilder.shared.history.made"
            : "pageBuilder.shared.history.used",
          { name: change.name },
        );
  return changeNode(context, nodeId, label, (node) => {
    if (change.kind === "make") return makeSharedStyle(node, change.id, change.name).node;
    if (change.kind === "use") return giveSharedStyle(node, change.id);
    return detachSharedStyle(node, change.sharedStyle);
  });
}

/**
 * Before a site variable is deleted: every element on the page that uses it gets its value
 * written out, so it looks as it did. One step in Undo; nothing when nothing uses it.
 */
export function writeOutVariable(
  context: CommandContext,
  variable: DesignVariable,
): CommandResult | null {
  const root = inlineVariableOnPage(context.document.root, variable);
  if (root === context.document.root) return null;
  return {
    change: {
      label: context.text("pageBuilder.siteStyles.history.variableWritten", {
        name: variable.name,
      }),
      update: (document) => ({ ...document, root: inlineVariableOnPage(document.root, variable) }),
    },
  };
}

/**
 * Before a shared style is deleted: every element on the page that uses it (or one of its
 * variants) takes the look as its own. One step in Undo; nothing when nothing uses it.
 */
export function detachEverything(
  context: CommandContext,
  sharedStyle: SharedStyle,
  /** The look each style id gave, for the shared style and its variants. */
  looks: Readonly<Record<string, SharedStyle>>,
): CommandResult | null {
  const detach = (node: PageNode): PageNode => {
    const children = node.children.map(detach);
    const changedChildren = children.some((child, index) => child !== node.children[index]);
    const look = node.sharedStyle ? looks[node.sharedStyle] : undefined;
    if (!look && !changedChildren) return node;
    const withChildren = changedChildren ? { ...node, children } : node;
    return look ? detachSharedStyle(withChildren, look) : withChildren;
  };
  if (detach(context.document.root) === context.document.root) return null;
  return {
    change: {
      label: context.text("pageBuilder.siteStyles.history.detachedAll", {
        name: sharedStyle.name,
      }),
      update: (document) => ({ ...document, root: detach(document.root) }),
    },
  };
}

/** Moves an element in its free layout, at one screen size: from dragging or nudging. */
export function placeFreely(
  context: CommandContext,
  nodeId: string,
  target: StyleTarget,
  place: FreePlace,
  label: string,
): CommandResult {
  return changeNode(
    context,
    nodeId,
    label,
    (node) => ({ ...node, styles: setStyles(node.styles, target, freePlaceStyles(place)) }),
    { coalesceKey: `place:${nodeId}:${target}` },
  );
}

/** Bring forward, send back and the like: z-index on the element and its siblings. */
export function restackNode(
  context: CommandContext,
  nodeId: string,
  move: StackingMove,
): CommandResult {
  const path = findPath(context.document.root, nodeId);
  const node = path.at(-1);
  const parent = path.at(-2);
  if (!node || !parent) return { refused: context.text("pageBuilder.refused.nothingSelected") };
  const order = restack(parent.children, nodeId, move);
  if (!order) {
    return {
      refused: context.text(
        move === "forward" || move === "front"
          ? "pageBuilder.design.alreadyFront"
          : "pageBuilder.design.alreadyBack",
        { name: layerName(node, context.catalogue) },
      ),
    };
  }
  const label = context.text(`pageBuilder.design.history.${move}`, {
    name: layerName(node, context.catalogue),
  });
  return changeNode(context, parent.id, label, (current) => ({
    ...current,
    children: current.children.map((child) => {
      const zIndex = order.get(child.id);
      return zIndex === undefined || child.styles.base.zIndex === zIndex
        ? child
        : { ...child, styles: setStyles(child.styles, "base", { zIndex }) };
    }),
  }));
}

export function setBackgroundVideo(
  context: CommandContext,
  nodeId: string,
  video: BackgroundVideo | null,
): CommandResult {
  const label = context.text(
    video ? "pageBuilder.design.history.videoSet" : "pageBuilder.design.history.videoRemoved",
  );
  return changeNode(context, nodeId, label, (node) => {
    if (video) return { ...node, backgroundVideo: video };
    const rest: PageNode = { ...node };
    delete rest.backgroundVideo;
    return rest;
  });
}

export function changePageFonts(
  context: CommandContext,
  fonts: PageFont[],
  label: string,
): CommandResult {
  return changeNode(
    context,
    rootNodeId,
    label,
    (root) => ({ ...root, props: { ...root.props, fonts } }),
    { evenIfLocked: true },
  );
}

/**
 * Styles part of a heading's or paragraph's text (`from` to `to`, in characters), or with
 * `styles` null takes every style off that part.
 */
export function markText(
  context: CommandContext,
  nodeId: string,
  range: { from: number; to: number },
  styles: MarkChange | null,
  label: string,
): CommandResult {
  return changeNode(context, nodeId, label, (node) => {
    const text = typeof node.props.text === "string" ? node.props.text : "";
    const marks = readMarks(node);
    const next = styles
      ? applyMark(marks, range.from, range.to, styles, text.length)
      : clearMarks(marks, range.from, range.to, text.length);
    return { ...node, props: withMarks(node.props, next) };
  });
}

export function readMarks(node: PageNode): TextMark[] {
  return Array.isArray(node.props.marks) ? (node.props.marks as TextMark[]) : [];
}

/** Props with these marks; no `marks` at all when there are none, so stored pages stay tidy. */
export function withMarks(
  props: Record<string, unknown>,
  marks: readonly TextMark[],
): Record<string, unknown> {
  const rest = { ...props };
  delete rest.marks;
  return marks.length === 0 ? rest : { ...rest, marks };
}
