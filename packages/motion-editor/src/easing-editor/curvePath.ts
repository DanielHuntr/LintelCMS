import { evaluateEasing, type Easing } from "@lintel/motion";

/** Drawing easing curves: time runs left to right, progress bottom to top, with room for overshoot. */

export interface CurveBox {
  size: number;
  /** Space above and below for curves that overshoot, as a fraction of the size. */
  overshoot: number;
}

export function pointFor(box: CurveBox, time: number, progress: number) {
  const inner = box.size / (1 + box.overshoot * 2);
  const top = inner * box.overshoot;
  return { x: time * box.size, y: top + (1 - progress) * inner };
}

/** The inverse of pointFor, for dragging handles. */
export function valueAt(box: CurveBox, x: number, y: number) {
  const inner = box.size / (1 + box.overshoot * 2);
  const top = inner * box.overshoot;
  return { time: x / box.size, progress: 1 - (y - top) / inner };
}

export function curvePath(easing: Easing, box: CurveBox, samples = 64): string {
  return Array.from({ length: samples + 1 }, (_, index) => {
    const time = index / samples;
    const { x, y } = pointFor(box, time, evaluateEasing(easing, time));
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
}
