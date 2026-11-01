import type { ForwardedKey } from "../canvas/canvas-messages.js";

/**
 * The builder's keyboard shortcuts, in one list. "Mod" is Cmd on a Mac and Ctrl elsewhere.
 *
 *   Mod+Z undo · Shift+Mod+Z or Mod+Y redo · Mod+C copy · Mod+X cut · Mod+D duplicate
 *   Delete or Backspace remove · Escape select the parent · Mod+S save now
 *   Alt+Up / Alt+Down move before or after the element next to it ("nudging")
 *   Alt+Right put it inside the element above · Alt+Left move it out of its parent
 *   Shift+Mod+H hide or show · Shift+Mod+L lock or unlock
 *   Up / Down (on the canvas) select the previous or next element
 *   Mod+] / Mod+[ bring forward or send back · Shift+Mod+] / Shift+Mod+[ to the front or back
 *   Arrows (on the canvas, in a free layout) nudge the selected element; Shift for 10px
 *
 * Pasting is handled by the paste event, so the system clipboard's HTML can be imported.
 */
export type ShortcutCommand =
  | "undo"
  | "redo"
  | "copy"
  | "cut"
  | "duplicate"
  | "remove"
  | "selectParent"
  | "save"
  | "moveUp"
  | "moveDown"
  | "moveIn"
  | "moveOut"
  | "toggleHidden"
  | "toggleLocked"
  | "selectPrevious"
  | "selectNext"
  | "bringForward"
  | "sendBackward"
  | "bringToFront"
  | "sendToBack";

export function isMac(): boolean {
  return (
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
  );
}

export function shortcutFor(key: ForwardedKey, onMac: boolean = isMac()): ShortcutCommand | null {
  const mod = onMac ? key.metaKey : key.ctrlKey;
  const name = key.key.length === 1 ? key.key.toLowerCase() : key.key;
  if (mod && !key.altKey) {
    if (name === "z") return key.shiftKey ? "redo" : "undo";
    if (name === "y" && !key.shiftKey) return "redo";
    if (name === "c" && !key.shiftKey) return "copy";
    if (name === "x" && !key.shiftKey) return "cut";
    if (name === "d" && !key.shiftKey) return "duplicate";
    if (name === "s" && !key.shiftKey) return "save";
    if (name === "h" && key.shiftKey) return "toggleHidden";
    if (name === "l" && key.shiftKey) return "toggleLocked";
    // With Shift, "]" and "[" arrive as "}" and "{" on most keyboards.
    if (name === "]" || name === "}") return key.shiftKey ? "bringToFront" : "bringForward";
    if (name === "[" || name === "{") return key.shiftKey ? "sendToBack" : "sendBackward";
    return null;
  }
  if (key.metaKey || key.ctrlKey) return null;
  if (key.altKey && !key.shiftKey) {
    const moves: Record<string, ShortcutCommand> = {
      ArrowUp: "moveUp",
      ArrowDown: "moveDown",
      ArrowRight: "moveIn",
      ArrowLeft: "moveOut",
    };
    return moves[name] ?? null;
  }
  if (key.altKey || key.shiftKey) return null;
  if (name === "Delete" || name === "Backspace") return "remove";
  if (name === "Escape") return "selectParent";
  if (name === "ArrowUp") return "selectPrevious";
  if (name === "ArrowDown") return "selectNext";
  return null;
}

/** Whether a key press belongs to a text box or other control rather than to the builder. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return (
    target.closest(
      "input, textarea, select, [contenteditable], [role='radiogroup'], [role='tablist']",
    ) !== null
  );
}
