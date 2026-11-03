import type { EffectBinding } from "@lintel/motion/effects";
import type { MotionSpec } from "@lintel/motion";
import type { DropPosition } from "../panels/layer-drop.js";
import type { PointerOver } from "./canvas-drop.js";

/**
 * What the builder and its canvas frame say to each other. The frame is sandboxed without
 * same-origin access, so it can't touch the admin and the admin can't touch it; these
 * messages are the only way through. Each side checks who sent a message before reading it.
 */

export interface OutlineLabels {
  selected: string | null;
  hovered: string | null;
}

export type MessageToFrame =
  | { type: "render"; html: string; css: string }
  | {
      type: "outline";
      selectedId: string | null;
      hoveredId: string | null;
      /** Elements outlined together, such as everything using a shared style. */
      highlightIds?: readonly string[];
      labels: OutlineLabels;
      /** Shows the turning handle and allows dragging and nudging: false when locked. */
      canTransform: boolean;
      /** Allows dragging elements to new places: false where only content may change. */
      canMove?: boolean;
      rotateLabel: string;
    }
  | { type: "reveal"; nodeId: string }
  /** Plays an animation once on an element, as a preview; the page itself doesn't change. */
  | { type: "previewMotion"; nodeId: string; spec: MotionSpec }
  /**
   * Runs an effect on an element until stopped, as a preview. `modules` says where each
   * effect module is served, since the canvas imports them on demand.
   */
  | {
      type: "previewEffect";
      nodeId: string;
      binding: Pick<EffectBinding, "module" | "behaviour" | "params">;
      modules: Readonly<Record<string, string>>;
    }
  | { type: "stopMotion" }
  /**
   * The selected element's scroll scene: where on the screen it starts and ends (0 the top,
   * 1 the bottom), drawn as lines people can drag. Null hides them.
   */
  | { type: "sceneMarkers"; markers: SceneMarkers | null }
  /** Where something dragged from Insert would land: a line, or a box for "inside". */
  | { type: "insertMarker"; marker: InsertMarker | null }
  /**
   * Something from Insert is being dragged (or the drag ended). The frame can't always see a
   * drag's type from another origin, so it's told, and accepts the drop because of this.
   */
  | { type: "insertDragging"; active: boolean }
  /**
   * The pointer is at `x`, `y` on the page while something from Insert is dragged. Browsers
   * don't pass a drag from the builder into the sandboxed frame, so the builder catches it
   * over the frame and says where it is; the frame answers with `insertOver`.
   */
  | { type: "insertPoint"; x: number; y: number };

export interface SceneMarkers {
  start: number;
  end: number;
  startLabel: string;
  endLabel: string;
  /** Read out while a line has focus and is moved with the arrow keys. */
  dragHint: string;
}

export interface InsertMarker {
  nodeId: string;
  position: DropPosition;
  across: boolean;
}

export interface ForwardedKey {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/** One link of a menu, picked on the canvas: its menu item's id and its words. */
export interface CanvasMenuItem {
  id: string;
  label: string;
}

export type MessageFromFrame =
  | { type: "ready" }
  /** `menuItem`: the link clicked, when it was one of a menu's links (see menu-links/). */
  | { type: "select"; nodeId: string | null; menuItem?: CanvasMenuItem }
  | { type: "hover"; nodeId: string | null }
  | { type: "editText"; nodeId: string; prop: string; text: string }
  | { type: "key"; key: ForwardedKey }
  | { type: "paste"; html: string; text: string }
  /** Files dropped on the page, over the element `nodeId` (null: over no element). */
  | { type: "dropFiles"; nodeId: string | null; files: File[] }
  /** Files pasted while the page had focus and no text was being typed. */
  | { type: "pasteFiles"; files: File[] }
  /** The selected element was turned with its handle, to this many degrees. */
  | { type: "rotate"; nodeId: string; degrees: number }
  /** An element was dragged or nudged in its free layout, to this place in percent. */
  | { type: "place"; nodeId: string; left: number; top: number }
  /** Ctrl (or ⌘) and the wheel, or a pinch, over the page: zoom the canvas. */
  | { type: "zoomWheel"; deltaY: number }
  /** An element was dragged, resized or nudged on its placed grid, to these lines. */
  | {
      type: "gridPlace";
      nodeId: string;
      column: number;
      columnSpan: number;
      row: number;
      rowSpan: number;
    }
  /**
   * Something from Insert is dragged over the page: where the pointer is in the element under
   * it and in each one around it (empty: over the page itself, below everything).
   */
  | { type: "insertOver"; chain: PointerOver[] }
  /** The drag left the canvas, or was let go on it. */
  | { type: "insertLeave" }
  | { type: "insertDrop" }
  /** The element `nodeId` is being dragged to a new place on the page, over `chain`. */
  | { type: "moveOver"; nodeId: string; chain: PointerOver[] }
  /** It was let go (moved to the place last shown), or the move was called off. */
  | { type: "moveDrop"; nodeId: string }
  | { type: "moveCancel" }
  /** "Add pages to your menu" was pressed in place of an empty menu. */
  | { type: "openMenu"; nodeId: string }
  /** A scroll scene's Start or End line was moved to this point on the screen (0 to 1). */
  | { type: "sceneMarker"; which: "start" | "end"; viewport: number }
  /** How the selected element looks, measured on the canvas, for the style panel. */
  | {
      type: "look";
      nodeId: string;
      textAlign: string;
      fontSize: number;
      fontWeight: string;
      color: string;
      /** How many columns it has as a grid; 0 when it isn't one. Missing from older frames. */
      gridColumns?: number;
    }
  /** Part of a text is selected (or, with nodeId null, nothing is). */
  | { type: "textSelection"; nodeId: null }
  | TextSelectionMessage;

export interface TextSelectionMessage {
  type: "textSelection";
  nodeId: string;
  prop: string;
  from: number;
  to: number;
  /** The text as it is on the canvas, which may have been typed into and not saved yet. */
  text: string;
}

const frameMessageTypes = new Set([
  "ready",
  "select",
  "hover",
  "editText",
  "key",
  "paste",
  "dropFiles",
  "pasteFiles",
  "rotate",
  "place",
  "gridPlace",
  "zoomWheel",
  "textSelection",
  "openMenu",
  "look",
  "insertOver",
  "insertLeave",
  "insertDrop",
  "moveOver",
  "moveDrop",
  "moveCancel",
  "sceneMarker",
]);

/** Reads a message from the frame, or null if it isn't one of ours. */
export function readFrameMessage(data: unknown): MessageFromFrame | null {
  if (typeof data !== "object" || data === null || !("type" in data)) return null;
  const { type } = data as { type: unknown };
  if (typeof type !== "string" || !frameMessageTypes.has(type)) return null;
  const message = data as Record<string, unknown>;
  const isText = (value: unknown) => typeof value === "string" && value.length < 200_000;
  const isOptionalId = (value: unknown) =>
    value === null || (typeof value === "string" && value.length <= 64);
  switch (type) {
    case "select": {
      const item = message.menuItem as Partial<CanvasMenuItem> | undefined;
      const itemIsFine =
        item === undefined ||
        (typeof item === "object" &&
          item !== null &&
          typeof item.id === "string" &&
          /^[A-Za-z0-9_-]{1,64}$/.test(item.id) &&
          typeof item.label === "string" &&
          item.label.length <= 200);
      return isOptionalId(message.nodeId) && itemIsFine ? (message as MessageFromFrame) : null;
    }
    case "hover":
      return isOptionalId(message.nodeId) ? (message as MessageFromFrame) : null;
    case "editText":
      return isText(message.nodeId) && isText(message.prop) && isText(message.text)
        ? (message as MessageFromFrame)
        : null;
    case "key":
      return typeof message.key === "object" &&
        message.key !== null &&
        isText((message.key as ForwardedKey).key)
        ? (message as MessageFromFrame)
        : null;
    case "paste":
      return isText(message.html) && isText(message.text) ? (message as MessageFromFrame) : null;
    case "dropFiles":
      return isOptionalId(message.nodeId) && areFiles(message.files)
        ? (message as MessageFromFrame)
        : null;
    case "pasteFiles":
      return areFiles(message.files) ? (message as MessageFromFrame) : null;
    case "moveOver":
    case "insertOver":
      if (type === "moveOver" && !isText(message.nodeId)) return null;
      return Array.isArray(message.chain) &&
        message.chain.length <= 64 &&
        message.chain.every(
          (over: unknown) =>
            typeof over === "object" &&
            over !== null &&
            isText((over as PointerOver).nodeId) &&
            isFiniteNumber((over as PointerOver).ratio) &&
            typeof (over as PointerOver).across === "boolean",
        )
        ? (message as MessageFromFrame)
        : null;
    case "insertLeave":
      return { type: "insertLeave" };
    case "insertDrop":
      return { type: "insertDrop" };
    case "moveDrop":
      return isText(message.nodeId) ? (message as MessageFromFrame) : null;
    case "moveCancel":
      return { type: "moveCancel" };
    case "openMenu":
      return isText(message.nodeId) ? (message as MessageFromFrame) : null;
    case "sceneMarker":
      return (message.which === "start" || message.which === "end") &&
        isFiniteNumber(message.viewport) &&
        message.viewport >= 0 &&
        message.viewport <= 1
        ? (message as MessageFromFrame)
        : null;
    case "rotate":
      return isText(message.nodeId) && isFiniteNumber(message.degrees)
        ? (message as MessageFromFrame)
        : null;
    case "place":
      return isText(message.nodeId) && isFiniteNumber(message.left) && isFiniteNumber(message.top)
        ? (message as MessageFromFrame)
        : null;
    case "zoomWheel":
      return isFiniteNumber(message.deltaY) ? { type: "zoomWheel", deltaY: message.deltaY } : null;
    case "gridPlace":
      return isText(message.nodeId) &&
        [message.column, message.columnSpan, message.row, message.rowSpan].every(isGridLine)
        ? (message as MessageFromFrame)
        : null;
    case "look":
      return isText(message.nodeId) &&
        isText(message.textAlign) &&
        isFiniteNumber(message.fontSize) &&
        isText(message.fontWeight) &&
        isText(message.color)
        ? (message as MessageFromFrame)
        : null;
    case "textSelection":
      if (message.nodeId === null) return { type: "textSelection", nodeId: null };
      return isText(message.nodeId) &&
        isText(message.prop) &&
        isText(message.text) &&
        isFiniteNumber(message.from) &&
        isFiniteNumber(message.to)
        ? (message as MessageFromFrame)
        : null;
    default:
      return { type: "ready" };
  }
}

/** A short list of real files: anything else from the frame is ignored. */
function areFiles(value: unknown): value is File[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= 10 &&
    value.every((file) => file instanceof File)
  );
}

/** A line or span on a grid: a whole number from 1, and never an absurd one. */
function isGridLine(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 500;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
