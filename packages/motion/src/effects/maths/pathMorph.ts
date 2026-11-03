/**
 * Morphing one SVG shape into another. Two paths only blend when they have the same points
 * in a matching order, which hand-drawn shapes rarely do, so each is flattened into a
 * closed outline of evenly spaced points, the second is turned to start where it best
 * lines up with the first, and then the points can simply be mixed.
 */

export type Point = readonly [number, number];

const commandPattern = /([MLHVCSQTZmlhvcsqtz])([^MLHVCSQTZmlhvcsqtz]*)/g;

function numbersIn(text: string): number[] {
  return (text.match(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? []).map(Number);
}

function cubicPoint(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
}

/**
 * The outline of path data as points: lines kept, curves (C, S, Q, T) sampled. Arcs are
 * treated as straight lines, which is enough for the shapes people morph between.
 */
export function flattenPath(pathData: string, curveSteps = 12): Point[] {
  const points: Point[] = [];
  let current: Point = [0, 0];
  let start: Point = [0, 0];
  let lastControl: Point | undefined;
  for (const [, command = "", argumentText = ""] of pathData.matchAll(commandPattern)) {
    const values = numbersIn(argumentText);
    const relative = command === command.toLowerCase();
    const upper = command.toUpperCase();
    const at = (x: number, y: number): Point =>
      relative ? [current[0] + x, current[1] + y] : [x, y];
    if (upper === "Z") {
      current = start;
      lastControl = undefined;
      continue;
    }
    const size = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7 }[upper] ?? 2;
    for (let index = 0; index + size <= values.length; index += size) {
      const v = values.slice(index, index + size) as number[];
      const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0] = v;
      if (upper === "M" || upper === "L" || upper === "T" || upper === "A") {
        current = upper === "A" ? at(v[5] ?? 0, v[6] ?? 0) : at(a, b);
        if (upper === "M" && index === 0) start = current;
        points.push(current);
        lastControl = undefined;
      } else if (upper === "H") {
        current = [relative ? current[0] + a : a, current[1]];
        points.push(current);
      } else if (upper === "V") {
        current = [current[0], relative ? current[1] + a : a];
        points.push(current);
      } else {
        const from = current;
        const reflected: Point = lastControl
          ? [2 * from[0] - lastControl[0], 2 * from[1] - lastControl[1]]
          : from;
        let c1: Point, c2: Point, end: Point;
        if (upper === "C") [c1, c2, end] = [at(a, b), at(c, d), at(e, f)];
        else if (upper === "S") [c1, c2, end] = [reflected, at(a, b), at(c, d)];
        else {
          const control = at(a, b);
          end = at(c, d);
          c1 = [
            from[0] + (2 / 3) * (control[0] - from[0]),
            from[1] + (2 / 3) * (control[1] - from[1]),
          ];
          c2 = [end[0] + (2 / 3) * (control[0] - end[0]), end[1] + (2 / 3) * (control[1] - end[1])];
        }
        for (let step = 1; step <= curveSteps; step += 1) {
          points.push(cubicPoint(from, c1, c2, end, step / curveSteps));
        }
        lastControl = c2;
        current = end;
      }
    }
  }
  return points;
}

/** `count` points spread evenly along a closed outline. */
export function resampleOutline(points: readonly Point[], count: number): Point[] {
  if (points.length === 0) return [];
  const closed = [...points, points[0] as Point];
  const lengths = [0];
  for (let index = 1; index < closed.length; index += 1) {
    const [x1, y1] = closed[index - 1] as Point;
    const [x2, y2] = closed[index] as Point;
    lengths.push((lengths[index - 1] ?? 0) + Math.hypot(x2 - x1, y2 - y1));
  }
  const total = lengths[lengths.length - 1] ?? 0;
  if (total === 0) return Array.from({ length: count }, () => points[0] as Point);
  const result: Point[] = [];
  let segment = 1;
  for (let index = 0; index < count; index += 1) {
    const distance = (index / count) * total;
    while ((lengths[segment] ?? total) < distance && segment < closed.length - 1) segment += 1;
    const segmentStart = lengths[segment - 1] ?? 0;
    const segmentLength = (lengths[segment] ?? total) - segmentStart;
    const t = segmentLength ? (distance - segmentStart) / segmentLength : 0;
    const [x1, y1] = closed[segment - 1] as Point;
    const [x2, y2] = closed[segment] as Point;
    result.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]);
  }
  return result;
}

function signedArea(points: readonly Point[]): number {
  let area = 0;
  points.forEach(([x1, y1], index) => {
    const [x2, y2] = points[(index + 1) % points.length] as Point;
    area += x1 * y2 - x2 * y1;
  });
  return area / 2;
}

/**
 * Gives two outlines the same number of points, running the same way round, with the second
 * turned so each point is as close as it can be to its partner. That is what makes a morph
 * look like one shape changing rather than folding through itself.
 */
export function matchOutlines(
  from: readonly Point[],
  to: readonly Point[],
  count = 64,
): [Point[], Point[]] {
  const first = resampleOutline(from, count);
  let second = resampleOutline(to, count);
  if (Math.sign(signedArea(first)) !== Math.sign(signedArea(second))) second = second.reverse();
  let bestShift = 0;
  let bestDistance = Infinity;
  for (let shift = 0; shift < count; shift += 1) {
    let distance = 0;
    for (let index = 0; index < count; index += 1) {
      const [x1, y1] = first[index] as Point;
      const [x2, y2] = second[(index + shift) % count] as Point;
      distance += (x1 - x2) ** 2 + (y1 - y2) ** 2;
    }
    if (distance < bestDistance) [bestDistance, bestShift] = [distance, shift];
  }
  second = second.map((_, index) => second[(index + bestShift) % count] as Point);
  return [first, second];
}

/** The outline part of the way from one matched outline to the other. */
export function mixOutlines(
  from: readonly Point[],
  to: readonly Point[],
  progress: number,
): Point[] {
  return from.map(([x1, y1], index) => {
    const [x2, y2] = to[index] ?? [x1, y1];
    return [x1 + (x2 - x1) * progress, y1 + (y2 - y1) * progress];
  });
}

/** Points back into path data: one closed shape. */
export function outlineToPath(points: readonly Point[]): string {
  const round = (value: number) => Math.round(value * 100) / 100;
  return (
    points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${round(x)} ${round(y)}`).join("") +
    "Z"
  );
}
