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
      labels: OutlineLabels;
      /** Shows the turning handle and allows dragging and nudging: false when locked. */
      canTransform: boolean;
      rotateLabel: string;
    }
  | { type: "reveal"; nodeId: string }
  /** Plays an animation once on an element, as a preview; the page itself doesn't change. */
  | { type: "previewMotion"; nodeId: string; spec: MotionSpec }
  | { type: "stopMotion" }
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

export type MessageFromFrame =
  | { type: "ready" }
  | { type: "select"; nodeId: string | null }
  | { type: "hover"; nodeId: string | null }
  | { type: "editText"; nodeId: string; prop: string; text: string }
  | { type: "key"; key: ForwardedKey }
  | { type: "paste"; html: string; text: string }
  /** The selected element was turned with its handle, to this many degrees. */
  | { type: "rotate"; nodeId: string; degrees: number }
  /** An element was dragged or nudged in its free layout, to this place in percent. */
  | { type: "place"; nodeId: string; left: number; top: number }
  /**
   * Something from Insert is dragged over the page: where the pointer is in the element under
   * it and in each one around it (empty: over the page itself, below everything).
   */
  | { type: "insertOver"; chain: PointerOver[] }
  /** The drag left the canvas, or was let go on it. */
  | { type: "insertLeave" }
  | { type: "insertDrop" }
  /** "Add pages to your menu" was pressed in place of an empty menu. */
  | { type: "openMenu"; nodeId: string }
  /** How the selected element looks, measured on the canvas, for the style panel. */
  | {
      type: "look";
      nodeId: string;
      textAlign: string;
      fontSize: number;
      fontWeight: string;
      color: string;
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
  "rotate",
  "place",
  "textSelection",
  "openMenu",
  "look",
  "insertOver",
  "insertLeave",
  "insertDrop",
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
    case "select":
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
    case "insertOver":
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
    case "openMenu":
      return isText(message.nodeId) ? (message as MessageFromFrame) : null;
    case "rotate":
      return isText(message.nodeId) && isFiniteNumber(message.degrees)
        ? (message as MessageFromFrame)
        : null;
    case "place":
      return isText(message.nodeId) && isFiniteNumber(message.left) && isFiniteNumber(message.top)
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

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
