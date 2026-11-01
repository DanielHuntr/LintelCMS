/**
 * The shapes an element can be cut to (`clip-path`), as the Style panel offers them: a few
 * ready-made ones and a polygon whose corners can be dragged. Polygon corners are stored as
 * percentages of the element, so the shape stretches with it at every screen size.
 */

export interface ShapePoint {
  x: number;
  y: number;
}

export type ShapePreset = "circle" | "ellipse" | "rounded" | "diagonal" | "slash" | "arch";

export const shapePresets: Record<ShapePreset, string> = {
  circle: "circle(50% at 50% 50%)",
  ellipse: "ellipse(50% 38% at 50% 50%)",
  rounded: "inset(0 round 2rem)",
  diagonal: "polygon(0% 0%, 100% 0%, 100% 78%, 0% 100%)",
  slash: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 62%, 58% 30%, 0% 46%)",
  arch: "inset(0 round 50% 50% 0 0)",
};

/** The preset a value is, or null for a hand-made or other shape. */
export function findShapePreset(value: string | undefined): ShapePreset | null {
  if (!value) return null;
  const entry = Object.entries(shapePresets).find(([, preset]) => preset === value);
  return entry ? (entry[0] as ShapePreset) : null;
}

/** A square's corners: where a new polygon starts. */
export const startingPolygon: readonly ShapePoint[] = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];

/** The corners of a `polygon(...)` in percentages, or null when it isn't one. */
export function parsePolygon(value: string | undefined): ShapePoint[] | null {
  const inside = value ? /^polygon\((.*)\)$/s.exec(value.trim())?.[1] : undefined;
  if (inside === undefined) return null;
  const points: ShapePoint[] = [];
  for (const pair of inside.split(",")) {
    const match = /^\s*(-?[\d.]+)%?\s+(-?[\d.]+)%?\s*$/.exec(pair);
    if (!match) return null;
    points.push({ x: Number(match[1]), y: Number(match[2]) });
  }
  return points.length >= 3 ? points : null;
}

export function polygonValue(points: readonly ShapePoint[]): string {
  const round = (value: number) => Math.round(Math.min(100, Math.max(0, value)) * 10) / 10;
  return `polygon(${points.map((point) => `${round(point.x)}% ${round(point.y)}%`).join(", ")})`;
}

/** A new corner halfway along the edge after `index`, for "Add a corner". */
export function insertPointAfter(points: readonly ShapePoint[], index: number): ShapePoint[] {
  const from = points[index];
  const to = points[(index + 1) % points.length];
  if (!from || !to) return [...points];
  const middle = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  return [...points.slice(0, index + 1), middle, ...points.slice(index + 1)];
}

/** Takes a corner away; a polygon keeps at least three. */
export function removePoint(points: readonly ShapePoint[], index: number): ShapePoint[] {
  return points.length <= 3 ? [...points] : points.filter((_, position) => position !== index);
}

export function movePoint(
  points: readonly ShapePoint[],
  index: number,
  to: ShapePoint,
): ShapePoint[] {
  const clamp = (value: number) => Math.min(100, Math.max(0, value));
  return points.map((point, position) =>
    position === index ? { x: clamp(to.x), y: clamp(to.y) } : point,
  );
}
