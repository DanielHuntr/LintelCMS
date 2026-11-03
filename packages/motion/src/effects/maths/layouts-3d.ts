/**
 * Pure maths for the curved and 3D layouts: where each picture of an arc carousel sits,
 * how a card stack lays out its cards, and how deep each layer of a "depth on scroll"
 * section is. Kept apart from the DOM so tests can check the shapes.
 */

const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** `value` wrapped into [-half, half), so an endless row has no ends. */
export function wrapAround(value: number, length: number): number {
  if (length <= 0) return 0;
  const half = length / 2;
  return ((((value + half) % length) + length) % length) - half;
}

export type ArcShape = "away" | "around";

/** How far round the curve items still show, in degrees. */
const arcLimit = (shape: ArcShape) => (shape === "around" ? 60 : 80);

export interface ArcPlacement {
  x: number;
  z: number;
  /** Degrees about the vertical axis. */
  turn: number;
  /** 0 hidden (round the back of the curve) to 1. */
  opacity: number;
}

/**
 * One item of an arc carousel, `offset` places from the middle (fractions allowed while it
 * moves). `bend` is the angle between neighbours, in degrees; `pitch` is an item's width
 * plus the gap. "away" bends the row like the outside of a drum, its ends going back;
 * "around" bends it round the viewer, like a curved screen, its ends coming forward.
 * For "around" the viewer stands a little behind the circle's middle (see `arcPerspective`).
 */
export function arcPlacement(
  offset: number,
  { bend, pitch, shape }: { bend: number; pitch: number; shape: ArcShape },
): ArcPlacement {
  const step = radians(Math.max(bend, 0.5));
  const radius = pitch / step;
  const angle = offset * step;
  const limit = radians(arcLimit(shape));
  const fade =
    Math.abs(angle) <= limit * 0.8 ? 1 : Math.max(0, (limit - Math.abs(angle)) / (limit * 0.2));
  const x = radius * Math.sin(angle);
  const z = shape === "around" ? radius * (1 - Math.cos(angle)) : -radius * (1 - Math.cos(angle));
  const turn = ((shape === "around" ? -1 : 1) * angle * 180) / Math.PI;
  return { x, z, turn, opacity: fade };
}

/**
 * The angle between neighbours actually used: at least `bend`, and wide enough that the
 * item wrapping from one end of the row to the other does so out of sight.
 */
export function arcBend(bend: number, count: number, shape: ArcShape): number {
  return Math.max(bend, (2 * arcLimit(shape)) / Math.max(count, 1));
}

/** How far away the viewer is: behind the middle of an "around" curve, so its ends stay in view. */
export function arcPerspective(bend: number, pitch: number, shape: ArcShape): number {
  const radius = pitch / radians(Math.max(bend, 0.5));
  return shape === "around" ? radius * 1.4 : Math.max(900, radius * 1.2);
}

export type StackLook = "pile" | "fan" | "tilted";

/** How the card `position` places from the top of a stack is drawn, as a CSS transform. */
export function stackTransform(
  position: number,
  { look, spread, reduced }: { look: StackLook; spread: number; reduced: boolean },
): string {
  if (look === "fan" && !reduced) {
    // A hand of cards: each turns about a point well below the stack and steps aside.
    const side = position % 2 ? 1 : -1;
    const step = Math.ceil(position / 2);
    return `translate3d(${side * step * spread * 1.6}px, ${step * spread * 0.4}px, ${-position * spread * 2}px) rotate(${side * step * 6}deg)`;
  }
  if (look === "tilted" && !reduced) {
    // Lying back in 3D: the cards behind rise and go further away, like a deck seen from the front.
    return `translate3d(0, ${-position * spread * 1.4}px, ${-position * spread * 5}px) rotateX(${position ? 6 + position * 2 : 0}deg)`;
  }
  const lean = reduced ? 0 : (position % 2 ? 1 : -1) * position * 1.5;
  return `translate3d(0, ${position * spread}px, ${-position * spread * 3}px) rotate(${lean}deg)`;
}

/**
 * Which card is on top as a stack passes through the screen: the first card while it comes
 * in, the last by the time it is two thirds of the way up.
 */
export function cardForProgress(progress: number, count: number): number {
  if (count <= 1) return 0;
  const through = Math.min(1, Math.max(0, (progress - 0.25) / 0.4));
  return Math.min(count - 1, Math.floor(through * count));
}

export type LayerOrder = "front-first" | "back-first" | "mixed";

/** Each layer's depth, from -1 (furthest back) to 1 (nearest), in page order. */
export function layerDepths(count: number, order: LayerOrder): number[] {
  if (count <= 1) return count === 1 ? [0] : [];
  return Array.from({ length: count }, (_, index) => {
    const even = 1 - (2 * index) / (count - 1);
    if (order === "back-first") return -even;
    if (order === "mixed") return Math.round(Math.cos(index * 2.4) * 100) / 100;
    return even;
  });
}

export type DepthLook = "gentle" | "deep" | "floating";

const depthLooks: Record<DepthLook, { depth: number; travel: number; tilt: number }> = {
  gentle: { depth: 40, travel: 0.05, tilt: 0 },
  deep: { depth: 120, travel: 0.1, tilt: 0 },
  floating: { depth: 80, travel: 0.08, tilt: 5 },
};

/**
 * A layer's transform for a section `progress` through the screen (0.5 when it is in the
 * middle, where every layer sits at its resting place apart from its depth). Nearer layers
 * move further, so they seem closer, like the view from a train window. The nearest sits
 * where the page put it; the others step back from there.
 */
export function depthLayerTransform(
  depth: number,
  progress: number,
  { look, strength, screenHeight }: { look: DepthLook; strength: number; screenHeight: number },
): string {
  const settings = depthLooks[look];
  // Layers only go back from where they are laid out, so nothing grows past the section's edges.
  const z = ((depth - 1) / 2) * settings.depth * strength;
  const y = (0.5 - progress) * depth * settings.travel * strength * screenHeight;
  const tilt = settings.tilt
    ? ` rotateX(${((progress - 0.5) * settings.tilt * strength).toFixed(2)}deg)`
    : "";
  // Each layer has its own perspective, so it shrinks about its own middle. A shared one would
  // pull everything towards the section's middle, and the layers on to one another.
  return `perspective(1000px) translate3d(0, ${y.toFixed(1)}px, ${z.toFixed(1)}px)${tilt}`;
}
