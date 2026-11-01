/**
 * Evaluates a CSS cubic-bezier() curve, so Lintel can sample easings itself: to blend
 * tracks that share a CSS property, and to draw curves in the editor.
 *
 * The curve runs from (0, 0) to (1, 1) with two handles. x is time and y is progress, so
 * finding y for a given time means first solving for the curve parameter whose x matches.
 */

export interface BezierHandles {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function coordinate(parameter: number, first: number, second: number): number {
  const inverse = 1 - parameter;
  return (
    3 * inverse * inverse * parameter * first +
    3 * inverse * parameter * parameter * second +
    parameter ** 3
  );
}

function slope(parameter: number, first: number, second: number): number {
  const inverse = 1 - parameter;
  return (
    3 * inverse * inverse * first +
    6 * inverse * parameter * (second - first) +
    3 * parameter * parameter * (1 - second)
  );
}

/** The curve parameter whose x is `time`: Newton's method, with bisection when it stalls. */
function solveParameter(time: number, x1: number, x2: number): number {
  let parameter = time;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const error = coordinate(parameter, x1, x2) - time;
    if (Math.abs(error) < 1e-7) return parameter;
    const gradient = slope(parameter, x1, x2);
    if (Math.abs(gradient) < 1e-6) break;
    parameter -= error / gradient;
  }
  let low = 0;
  let high = 1;
  parameter = time;
  while (high - low > 1e-7) {
    if (coordinate(parameter, x1, x2) < time) low = parameter;
    else high = parameter;
    parameter = (low + high) / 2;
  }
  return parameter;
}

export function evaluateCubicBezier(handles: BezierHandles, time: number): number {
  if (time <= 0) return 0;
  if (time >= 1) return 1;
  const { x1, y1, x2, y2 } = handles;
  if (x1 === y1 && x2 === y2) return time;
  return coordinate(solveParameter(time, x1, x2), y1, y2);
}
