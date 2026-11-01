/**
 * Where a dragged element lands in a free layout: close to an edge or the middle of the
 * section, or lined up with an edge or middle of another element, it snaps there, and a
 * guide line shows what it lined up with. Everything is in pixels within the section.
 *
 * Written as one self-contained function (no imports, no outside names), because the canvas
 * frame gets it as text alongside its own script (see `canvasFrameSource`).
 */

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Guide {
  /** "x" is a vertical line at `position` from the left; "y" a horizontal one from the top. */
  axis: "x" | "y";
  position: number;
}

export interface Snapped {
  left: number;
  top: number;
  guides: Guide[];
}

export function snapBox(
  moving: Box,
  others: readonly Box[],
  frame: { width: number; height: number },
  threshold: number,
): Snapped {
  const along = (axis: "x" | "y") => {
    const start = axis === "x" ? moving.left : moving.top;
    const size = axis === "x" ? moving.width : moving.height;
    const ownLines = [start, start + size / 2, start + size];
    const frameSize = axis === "x" ? frame.width : frame.height;
    const targets = [0, frameSize / 2, frameSize];
    for (const other of others) {
      const otherStart = axis === "x" ? other.left : other.top;
      const otherSize = axis === "x" ? other.width : other.height;
      targets.push(otherStart, otherStart + otherSize / 2, otherStart + otherSize);
    }
    let best: { shift: number; line: number } | null = null;
    for (const own of ownLines) {
      for (const target of targets) {
        const shift = target - own;
        if (Math.abs(shift) <= threshold && (!best || Math.abs(shift) < Math.abs(best.shift))) {
          best = { shift, line: target };
        }
      }
    }
    return best;
  };
  const snapX = along("x");
  const snapY = along("y");
  const guides: Guide[] = [];
  if (snapX) guides.push({ axis: "x", position: snapX.line });
  if (snapY) guides.push({ axis: "y", position: snapY.line });
  return {
    left: moving.left + (snapX ? snapX.shift : 0),
    top: moving.top + (snapY ? snapY.shift : 0),
    guides,
  };
}

/** A place in pixels as percentages of the section, the way it is stored. */
export function toPercentPlace(
  left: number,
  top: number,
  frame: { width: number; height: number },
): { left: number; top: number } {
  return {
    left: frame.width > 0 ? (left / frame.width) * 100 : 0,
    top: frame.height > 0 ? (top / frame.height) * 100 : 0,
  };
}
